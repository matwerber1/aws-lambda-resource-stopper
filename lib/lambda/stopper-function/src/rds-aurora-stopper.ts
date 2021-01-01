import { ResourceStopper, ResourceStopperProps } from "./resource-stopper";
import * as RDS from "@aws-sdk/client-rds";

export class RdsAuroraStopper extends ResourceStopper {

    protected client: RDS.RDS;
    protected readonly resourceType:string = "RDS Aurora cluster";

    constructor(props:ResourceStopperProps) {
        super(props);
        this.client = new RDS.RDS(props.awsClientConfig || {});
    }

    protected async listResources(): Promise<void> {
        
        let clusters: RDS.DBCluster[] = [];
        let response: RDS.DescribeDBClustersCommandOutput;
        let params: RDS.DescribeDBClustersCommandInput = {};
        
        do {
            response = await this.client.describeDBClusters(params);
            clusters = clusters.concat(response.DBClusters || []);
            params.Marker = response.Marker;
            
        } while (response.Marker);

        for (const cluster of clusters) {
            
            if (this.resourceIsEligibleToStop(cluster)) {
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

            let params:RDS.ListTagsForResourceCommandInput = {
                ResourceName: clusterArn
            };
      
            let tagResponse:RDS.ListTagsForResourceCommandOutput = await this.client.listTagsForResource(params);
            let tags:RDS.Tag[] = tagResponse.TagList || [];
                
            let tag:RDS.Tag;
            for (tag of tags) {
                if (tag.Key === this.keepRunningTag.key && tag.Value === this.keepRunningTag.value) {
                    this.resourceIdsTaggedToKeepRunning.push(clusterId);
                }
            }
        }

    }

    protected resourceIsEligibleToStop(resource:RDS.DBCluster) {

        return (resource.Status === 'available');
   
    }

    protected async stopResourcesAPI(): Promise<void> {

        let clusterId: string;

        for (clusterId of this.resourceIds) {
            let params: RDS.StopDBClusterCommandInput = {
                DBClusterIdentifier: clusterId
            };
            await this.client.stopDBCluster(params);
        }        
    }
}