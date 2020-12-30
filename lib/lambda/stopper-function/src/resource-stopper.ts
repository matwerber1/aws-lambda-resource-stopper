import { Credentials } from '@aws-sdk/client-sts';
import * as CredentialProvider from '@aws-sdk/credential-provider-node';
import { Ec2Stopper } from './ec2-stopper';

export interface ResourceStopperProps {
    accountId: string;
    dryRun?: boolean;
    awsClientConfig?: object;
}

export abstract class ResourceStopper {
    
    protected accountId: string;
    protected client: any;
    protected resourceIds: string[] = [];
    protected resourceIdsTaggedToKeepRunning: string[] = [];
    protected readonly resourceType:string = '';
    protected dryRun:boolean = false;
    protected readonly keepRunningTag = {
        key: 'KeepRunning',
        value: 'true'
    };

    protected constructor(params:ResourceStopperProps) {
        if (params.dryRun) {
            this.dryRun = params.dryRun;
        }
        this.accountId = params.accountId;
    }

    protected abstract listResourcesAPI(): Promise<void>;
    protected abstract resourceIsRunning(resource: any): boolean;    
    protected abstract getResourcesTaggedToKeepRunning(): Promise<void>;
    protected abstract stopResourcesAPI(): Promise<void>;

    public ignoreResourcesTaggedToKeepRunning(): void {

        console.log('Checking whether any resources are tagged to keep running...');

        // Remove any resource from our list of resources to stop if it is tagged with KeepRunning = true;
        let keepRunningCount = 0;
        
        this.resourceIds = this.resourceIds.filter(resourceId => {
        
            let resourceIsTaggedToKeepRunning:boolean = this.resourceIdsTaggedToKeepRunning.indexOf(resourceId) >= 0;
            
            if (resourceIsTaggedToKeepRunning) {
                console.log(`${this.resourceType} ${resourceId} is tagged with ${this.keepRunningTag.key}=${this.keepRunningTag.value} and will not be stopped.`);
                keepRunningCount += 1;
            }
        
            // Only return resources *not* tagged to keep running:
            return !resourceIsTaggedToKeepRunning;
        
        });

        if (keepRunningCount === 0) {
            console.log('No instances tagged to keep running. All running resources will be stopped.');
        }
    
    }

    private async listResources(): Promise<void> {
        await this.listResourcesAPI();
        console.log(`The following ${this.resourceType}s are running: ${JSON.stringify(this.resourceIds)}`);
    }

    public async stopResources(): Promise<void> {

        await this.listResources();
        await this.getResourcesTaggedToKeepRunning();
        this.ignoreResourcesTaggedToKeepRunning();
        
        if (this.resourceIds.length > 0) {
            console.log(`Stopping the following ${this.resourceType} resources: ${JSON.stringify(this.resourceIds)}`);
            if (this.dryRun) {
                console.log('---> You specified dryRun=true in function call. Skipping actual stop.');
            }
            else {
                await this.stopResourcesAPI();
                console.log(`${this.resourceIds.length} ${this.resourceType}${this.resourceIds.length > 1 ? 's' : '' } successfully stopped.`);
            }
        }
        else {
            console.log(`No ${this.resourceType}s to stop.`);
        }
    }
}