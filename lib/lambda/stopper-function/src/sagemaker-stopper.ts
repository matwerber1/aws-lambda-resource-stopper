import { ResourceStopper, ResourceStopperProps } from "./resource-stopper";
import * as SageMaker from "@aws-sdk/client-sagemaker";

export class SageMakerStopper extends ResourceStopper {

    protected client: SageMaker.SageMaker;
    protected readonly resourceType:string = "SageMaker notebook";

    constructor(props:ResourceStopperProps) {
        super(props);
        this.client = new SageMaker.SageMaker(props.awsClientConfig || {});
    }

    protected async listResourcesAPI(): Promise<void> {
        
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
            let notebookArn = `arn:aws:sagemaker:${region}:${this.accountId}:notebook-instance/${notebookId}`;

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

    protected async stopResourcesAPI(): Promise<void> {

        let notebookInstanceName: string;

        for (notebookInstanceName of this.resourceIds) {
            let params: SageMaker.StopNotebookInstanceCommandInput = {
                NotebookInstanceName: notebookInstanceName
            };
            await this.client.stopNotebookInstance(params);
        }        
    }
}