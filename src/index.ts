import * as EC2 from "@aws-sdk/client-ec2";
import * as SageMaker from "@aws-sdk/client-sagemaker";
import * as CredentialProvider from '@aws-sdk/credential-provider-node';
import * as STS from '@aws-sdk/client-sts';

const LOCAL_SDK_CONFIG = {
    region: 'us-west-2',
    credentials: CredentialProvider.defaultProvider({ profile: 'ctt-experiment'})
}

let ACCOUNT_ID:string;

export const handler = async (event: any = {}): Promise<any> => {
    
    let response:string = "";

    try {

        ACCOUNT_ID = await getAccountId();
        
        let resourceTypesToStop:string[] = [
            //'ec2',
            'sagemaker'
        ];

        for (const resourceTypeToStop of resourceTypesToStop) {
            
            console.log(`Preparing to stop ${resourceTypeToStop} resources...`);

            let stopper:ResourceStopper;
    
            switch (resourceTypeToStop) {
                case 'ec2':
                    stopper = new Ec2Stopper();
                    break;
                case 'sagemaker': 
                    stopper = new SageMakerStopper();
                    break;
                default: 
                    throw new Error(`Unsupported resource type: ${resourceTypeToStop}`);
            }
        
            await stopper.stopResources();
            
            console.log('\n');
        }

        response = 'Done!';
        
    }
    catch(error) {
        response = error;
    }
    console.log(response);
    return response;
}

async function getAccountId(): Promise<string> {

    let CONFIG = {};
    if (process.env.LOCAL_AWS === "TRUE") {
        CONFIG = LOCAL_SDK_CONFIG;
    }
    let sts = new STS.STS(CONFIG);
    let response = await sts.getCallerIdentity({});
    return response.Account || '';

}

interface ResourceTag {
    resourceId: string;
    key: string;
    value: string;
}

abstract class ResourceStopper {
    
    protected client: any;
    protected resourceIds: string[] = [];
    protected resourceIdsTaggedToKeepRunning: string[] = [];
    protected readonly resourceType:string = '';
    protected readonly keepRunningTag = {
        key: 'KeepRunning',
        value: 'true'
    };


    public async getResourceIds(): Promise<string[]> {
        await this.listResources();
        return this.resourceIds;
    }

    protected abstract listResources(): Promise<void>;
    protected abstract resourceIsRunning(resource: any): boolean;    
    protected abstract getResourcesTaggedToKeepRunning(): Promise<void>;
    protected abstract stopAwsResources(): Promise<void>;

    public ignoreResourcesTaggedToKeepRunning(): void {

        // Remove any resource from our list of resources to stop if it is tagged with KeepRunning = true;
        this.resourceIds = this.resourceIds.filter(resourceId => {
            let resourceIsTaggedToKeepRunning:boolean = this.resourceIdsTaggedToKeepRunning.indexOf(resourceId) < 0;
            console.log(`${this.resourceType} ${resourceId} is tagged with ${this.keepRunningTag.key}=${this.keepRunningTag.value} and will not be stopped.`);
            return resourceIsTaggedToKeepRunning;
        });

    }

    public async stopResources(): Promise<void> {
        
        await this.listResources();
        console.log(`The following ${this.resourceType}s are running:\n`, this.resourceIds);

        console.log(`Checking whether ${this.resourceType}s are tagged to keep running...`);
        await this.getResourcesTaggedToKeepRunning();
        this.ignoreResourcesTaggedToKeepRunning();
        
        if (this.resourceIds.length > 0) {
            console.log(`Preparing to stop the following ${this.resourceType} resources:\n`, this.resourceIds );
            await this.stopAwsResources();
            console.log(`${this.resourceIds.length} ${this.resourceType}${this.resourceIds.length > 1 ? 's' : '' } successfully stopped.`);
        }
        else {
            console.log(`No ${this.resourceType}s to stop.`);
        }
    }
}


/**
 * Stop running EC2 instances: 
 */
class Ec2Stopper extends ResourceStopper {

    protected client: EC2.EC2;
    protected readonly resourceType:string = "EC2 instance";

    constructor() {
        super();
        let CONFIG = {};
        if (process.env.LOCAL_AWS === "TRUE") {
            CONFIG = LOCAL_SDK_CONFIG;
        }
        this.client = new EC2.EC2(CONFIG);
    }

    protected async listResources(): Promise<void> {
        
        console.log(`Getting ${this.resourceType} resource IDs...`);

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
                if (instance.InstanceId && this.resourceIsRunning(instance)) {
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

    protected resourceIsRunning(resource:EC2.Instance): boolean {

        if ('State' in resource) {
            return (resource.State?.Name === 'running')
        }
        else {
            return false;
        }
    }

    protected async stopAwsResources(): Promise<void> {

        let params: EC2.StopInstancesRequest = {
            InstanceIds: this.resourceIds
        };
        await this.client.stopInstances(params);
    }
}

/**
 * Stop running SageMaker instances: 
 */
class SageMakerStopper extends ResourceStopper {

    protected client: SageMaker.SageMaker;
    protected readonly resourceType:string = "SageMaker notebook";

    constructor() {
        super();
        let CONFIG = {};
        if (process.env.LOCAL_AWS === "TRUE") {
            CONFIG = LOCAL_SDK_CONFIG;
        }
        this.client = new SageMaker.SageMaker(CONFIG);
    }

    protected async listResources(): Promise<void> {
        
        console.log(`Getting ${this.resourceType} resource IDs...`);

        let notebookInstances: SageMaker.NotebookInstanceSummary[] = [];
        let response: SageMaker.ListNotebookInstancesOutput;
        let params: SageMaker.ListNotebookInstancesInput = {};
        
        do {
            response = await this.client.listNotebookInstances(params);
            notebookInstances = notebookInstances.concat(response.NotebookInstances || []);
            params.NextToken = response.NextToken;
            
        } while (response.NextToken);

        for (const notebookInstance of notebookInstances) {
            
            if (this.resourceIsRunning(notebookInstance)) {
                if (notebookInstance.NotebookInstanceName) {
                    this.resourceIds.push(notebookInstance.NotebookInstanceName);
                }
            } 
        }
        
    }

    protected async getResourcesTaggedToKeepRunning(): Promise<void> {
        
        let region = process.env.AWS_REGION;
            
        for (const notebookId of this.resourceIds) {
            let notebookArn = `arn:aws:sagemaker:${region}:${ACCOUNT_ID}:notebook-instance/${notebookId}`;

            let params:SageMaker.ListTagsCommandInput = {
                ResourceArn: notebookArn
            };
            
            let tagResponse:SageMaker.ListTagsCommandOutput;
            let tags:SageMaker.Tag[] = [];

            do {
            
                tagResponse = await this.client.listTags(params);
                tags = tags.concat(tagResponse.Tags || []);
                params.NextToken = tagResponse.NextToken;
            
            } while (tagResponse.NextToken)
            
            let tag:SageMaker.Tag;
            for (tag of tags) {
                if (tag.Key === this.keepRunningTag.key && tag.Value === this.keepRunningTag.value) {
                    this.resourceIdsTaggedToKeepRunning.push(notebookId);
                }
            }
        }

    }

    protected resourceIsRunning(resource:SageMaker.NotebookInstanceSummary) {

        return (resource.NotebookInstanceStatus === 'InService');
   
    }

    protected async stopAwsResources(): Promise<void> {

        let notebookInstanceName: string;

        for (notebookInstanceName of this.resourceIds) {
            let params: SageMaker.StopNotebookInstanceCommandInput = {
                NotebookInstanceName: notebookInstanceName
            };
            await this.client.stopNotebookInstance(params);
        }        
    }
}