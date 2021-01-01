import { ResourceStopper, ResourceStopperProps } from "./resource-stopper";
import * as EC2 from "@aws-sdk/client-ec2";

export class Ec2Stopper extends ResourceStopper {

    protected client: EC2.EC2;
    protected readonly resourceType:string = "EC2 instance";

    constructor(props:ResourceStopperProps) {
        super(props);
        this.client = new EC2.EC2(props.awsClientConfig || {});
    }

    protected async listResources(): Promise<void> {
        
        let reservations: EC2.Reservation[] = [];
        let response: EC2.DescribeInstancesResult;
        let params: EC2.DescribeInstancesRequest = {};
        
        do {
            response = await this.client.describeInstances(params);
            reservations = reservations.concat(response.Reservations || []);
            params.NextToken = response.NextToken;
            
        } while (response.NextToken);

        for (const reservation of reservations) {

            let instances:EC2.Instance[] = reservation.Instances || [];
            
            for (const instance of instances) {
                if (instance.InstanceId && this.resourceIsEligibleToStop(instance)) {
                    this.resourceIds.push(instance.InstanceId);
                } 
            }

        }
    }

    protected async getResourcesTaggedToKeepRunning(): Promise<void> {

        let resourceIdFilter:EC2.Filter = {
            Name: 'resource-id',
            Values: this.resourceIds
        };

        let resourceTypeFilter:EC2.Filter = {
            Name: 'resource-type',
            Values: ['instance']
        };

        let resourceTagFilter:EC2.Filter = {
            Name: `tag:${this.keepRunningTag.key}`,
            Values: [this.keepRunningTag.value]
        };

        let params:EC2.DescribeTagsRequest = {
            Filters: [
                resourceIdFilter,
                resourceTypeFilter,
                resourceTagFilter
            ]
        };

        let tagResponse:EC2.DescribeTagsResult;
        let tagDescriptions:EC2.TagDescription[] = [];

        do {
        
            tagResponse = await this.client.describeTags(params);
            params.NextToken = tagResponse.NextToken;
            tagDescriptions = tagDescriptions.concat(tagResponse.Tags || []);

        } while (tagResponse.NextToken)
        
        // We need to "normalize" the tag responses from the native AWS API
        // into the format that we plan to use:
        var resourceIdsTaggedToKeepRunning:string[];

        resourceIdsTaggedToKeepRunning = tagDescriptions.map(description => {
            return description.ResourceId || '';
        });

        this.resourceIdsTaggedToKeepRunning = resourceIdsTaggedToKeepRunning;

    }

    protected resourceIsEligibleToStop(resource:EC2.Instance): boolean {

        if ('State' in resource) {
            return (resource.State?.Name === 'running')
        }
        else {
            return false;
        }
    }

    protected async stopResourcesAPI(): Promise<void> {

        let params: EC2.StopInstancesRequest = {
            InstanceIds: this.resourceIds
        };
        await this.client.stopInstances(params);
    }
}