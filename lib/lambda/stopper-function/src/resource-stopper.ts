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

    protected abstract listResources(): Promise<void>;
    protected abstract resourceIsEligibleToStop(resource: any): boolean;    
    protected abstract getResourcesTaggedToKeepRunning(): Promise<void>;
    protected abstract stopResourcesAPI(): Promise<void>;

    public ignoreResourcesTaggedToKeepRunning(): void {

        console.log('Checking whether any resources are tagged to keep running...');

        // Remove any resource from our list of resources to stop if it is tagged with KeepRunning = true;
        let keepRunningCount = 0;
        let keepRunningResourceIds:string[] = [];

        this.resourceIds = this.resourceIds.filter(resourceId => {
        
            let resourceIsTaggedToKeepRunning:boolean = this.resourceIdsTaggedToKeepRunning.indexOf(resourceId) >= 0;
            
            if (resourceIsTaggedToKeepRunning) {
                keepRunningCount += 1;
                keepRunningResourceIds.push(resourceId)
            }
        
            // Only return resources *not* tagged to keep running:
            return !resourceIsTaggedToKeepRunning;
        
        });

        if (keepRunningCount === 0) {
            console.log('No instances tagged to keep running. All running resources will be stopped.');
        } else {
            console.log(`The following ${this.resourceType}(s) are tagged with ${this.keepRunningTag.key}=${this.keepRunningTag.value} and will not be stopped:\n${JSON.stringify(keepRunningResourceIds,null,2)}`);
        }
    
    }

    public async stopResources(): Promise<void> {

        await this.listResources();
        
        if (this.resourceIds.length > 0) {
            console.log(`The following ${this.resourceType}s are running and eligible to stop:\n${JSON.stringify(this.resourceIds, null, 2)}`);
        }
        else {
            console.log(`No ${this.resourceType}s eligible for stopping, nothing left to do.`);
            return;
        }
        await this.getResourcesTaggedToKeepRunning();
        this.ignoreResourcesTaggedToKeepRunning();
        
        if (this.resourceIds.length > 0) {
            console.log(`Stopping the following ${this.resourceType} resources:\n${JSON.stringify(this.resourceIds, null,2)}`);
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