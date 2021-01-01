import { ResourceStopper, ResourceStopperProps } from "./resource-stopper";
import * as Redshift from "@aws-sdk/client-redshift";

export class RedshiftStopper extends ResourceStopper {

    protected client: Redshift.Redshift;
    protected readonly resourceType:string = "Redshift cluster";

    constructor(props:ResourceStopperProps) {
        super(props);
        this.client = new Redshift.Redshift(props.awsClientConfig || {});
    }

    protected async listResources(): Promise<void> {
        
        let clusters: Redshift.Cluster[] = [];
        let response: Redshift.DescribeClustersCommandOutput;
        let params: Redshift.DescribeClustersCommandInput = {};
        
        do {
            response = await this.client.describeClusters(params);
            clusters = clusters.concat(response.Clusters || []);
            params.Marker = response.Marker;
            
        } while (response.Marker);

        for (const cluster of clusters) {
            
            if (this.resourceIsEligibleToStop(cluster)) {
                if (cluster.ClusterIdentifier) {
                    this.resourceIds.push(cluster.ClusterIdentifier);
                }
            } 
        }
    }

    protected async getResourcesTaggedToKeepRunning(): Promise<void> {

        let params:Redshift.DescribeTagsCommandInput = {
            ResourceType: 'Cluster',
            TagKeys: ['KeepRunning'],
            TagValues: ['true']
        };

        let tagResponse:Redshift.DescribeTagsCommandOutput;
        let taggedResources:Redshift.TaggedResource[] = [];

        do {
        
            tagResponse = await this.client.describeTags(params);
            params.Marker = tagResponse.Marker;
            taggedResources = taggedResources.concat(tagResponse.TaggedResources || []);

        } while (tagResponse.Marker)
        
        // We need to "normalize" the tag responses from the native AWS API
        // into the format that we plan to use:
        var resourceIdsTaggedToKeepRunning:string[];

        resourceIdsTaggedToKeepRunning = taggedResources.map(taggedResource => {
            return taggedResource.ResourceName || '';
        });

        this.resourceIdsTaggedToKeepRunning = resourceIdsTaggedToKeepRunning;

    }

    protected resourceIsEligibleToStop(resource:Redshift.Cluster): boolean {

        if ('ClusterStatus' in resource) {
            return (resource.ClusterStatus === 'running')
        }
        else {
            return false;
        }
    }

    protected async stopResourcesAPI(): Promise<void> {

        let clusterIdentifier: string;

        for (clusterIdentifier of this.resourceIds) {
            let params: Redshift.PauseClusterCommandInput = {
                ClusterIdentifier: clusterIdentifier
            };
            await this.client.pauseCluster(params);
        }    
    }
}