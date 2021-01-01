import { ResourceStopper, ResourceStopperProps } from "./resource-stopper";
import * as Neptune from "@aws-sdk/client-neptune";

export class NeptuneStopper extends ResourceStopper {

    protected client: Neptune.Neptune;
    protected readonly resourceType:string = "Neptune cluster";

    constructor(props:ResourceStopperProps) {
        super(props);
        this.client = new Neptune.Neptune(props.awsClientConfig || {});
    }

    protected async listResources(): Promise<void> {
        
        let clusters: Neptune.DBCluster[] = [];
        let response: Neptune.DescribeDBClustersCommandOutput;
        let params: Neptune.DescribeDBClustersCommandInput = {};
        
        do {
            response = await this.client.describeDBClusters(params);
            clusters = clusters.concat(response.DBClusters || []);
            params.Marker = response.Marker;
            
        } while (response.Marker);

        for (const cluster of clusters) {
            
            if (this.resourceIsRunning(cluster)) {
                if (cluster.DBClusterIdentifier) {
                    this.resourceIds.push(cluster.DBClusterIdentifier);
                }
            } 
        }
        
    }

    protected async getResourcesTaggedToKeepRunning(): Promise<void> {
        
        let region = process.env.AWS_REGION;
            
        for (const clusterId of this.resourceIds) {
            let clusterArn = `arn:aws:rds:${region}:${this.accountId}:cluster:${clusterId}`;

            let params:Neptune.ListTagsForResourceCommandInput = {
                ResourceName: clusterArn
            };
      
            let tagResponse:Neptune.ListTagsForResourceCommandOutput = await this.client.listTagsForResource(params);
            let tags:Neptune.Tag[] = tagResponse.TagList || [];
                
            let tag:Neptune.Tag;
            for (tag of tags) {
                if (tag.Key === this.keepRunningTag.key && tag.Value === this.keepRunningTag.value) {
                    this.resourceIdsTaggedToKeepRunning.push(clusterId);
                }
            }
        }

    }

    protected resourceIsRunning(resource:Neptune.DBCluster) {

        return (resource.Status === 'available');
   
    }

    protected async stopResourcesAPI(): Promise<void> {

        let clusterId: string;

        for (clusterId of this.resourceIds) {
            let params: Neptune.StopDBClusterCommandInput = {
                DBClusterIdentifier: clusterId
            };
            await this.client.stopDBCluster(params);
        }        
    }
}