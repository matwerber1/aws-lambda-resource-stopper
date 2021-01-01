import { ResourceStopper, ResourceStopperProps } from "./resource-stopper";
import * as RDS from "@aws-sdk/client-rds";

// This is for any RDS database *except* Aurora, since Aurora uses different
// APIs to describe and stop the cluster: 
export class RdsStopper extends ResourceStopper {

    protected client: RDS.RDS;
    protected readonly resourceType:string = "RDS database";

    constructor(props:ResourceStopperProps) {
        super(props);
        this.client = new RDS.RDS(props.awsClientConfig || {});
    }

    protected async listResources(): Promise<void> {
        
        let dbInstances: RDS.DBInstance[] = [];
        let response: RDS.DescribeDBInstancesCommandOutput;

        let engineFilter:RDS.Filter = {
            Name: 'engine',
            Values: [
                'mariadb',
                'mysql',
                'postgres',
                'sqlserver-ee',
                'sqlserver-web',
                'sqlserver-ex',
                'sqlserver-se',
                
                // For reasons I can't go in to, my AWS account does not allow Oracle RDS to launch, 
                // and so including Oracle filter values will throw an error. I have to excude these: 
                //'oracle-ee',
                //'oracle-se2',
                //'oracle-se1',
                //'oracle-se'
            ]
        }

        let params: RDS.DescribeDBInstancesCommandInput = {
            Filters: [
                engineFilter
            ]
        };
        
        do {
            response = await this.client.describeDBInstances(params);
            dbInstances = dbInstances.concat(response.DBInstances || []);
            params.Marker = response.Marker;
            
        } while (response.Marker);

        for (const dbInstance of dbInstances) {
            
            if (this.resourceIsEligibleToStop(dbInstance)) {
                if (dbInstance.DBInstanceIdentifier) {
                    this.resourceIds.push(dbInstance.DBInstanceIdentifier);
                }
            } 
        }
        
    }

    protected async getResourcesTaggedToKeepRunning(): Promise<void> {
        
        let region = process.env.AWS_REGION;
            
        for (const dbInstanceId of this.resourceIds) {
            let databaseArn = `arn:aws:rds:${region}:${this.accountId}:db:${dbInstanceId}`;
 
            let params:RDS.ListTagsForResourceCommandInput = {
                ResourceName: databaseArn
            };
      
            let tagResponse:RDS.ListTagsForResourceCommandOutput = await this.client.listTagsForResource(params);
            let tags:RDS.Tag[] = tagResponse.TagList || [];
                
            let tag:RDS.Tag;
            for (tag of tags) {
                if (tag.Key === this.keepRunningTag.key && tag.Value === this.keepRunningTag.value) {
                    this.resourceIdsTaggedToKeepRunning.push(dbInstanceId);
                }
            }
        }

    }

    protected resourceIsEligibleToStop(resource:RDS.DBInstance) {

        // Used to test if RDS engine is SQL Server: 
        let sqlserverEngineRegex = /^sqlserver-/;

        if (resource.DBInstanceStatus === 'available') {
            
            // If this array is not empty, it means this database is a source being
            // replicated to one or more replicas. A replicated database cannot be stopped:
            if (resource.ReadReplicaDBInstanceIdentifiers?.length || 0 > 0) {
                console.log(`${resource.DBInstanceIdentifier} is running and available, but cannot be stopped because it is the source for one or more read replicas.`);
                return false;
            }
            // If this key exists, it means the database instance is a read replica, and
            // RDS does not allow stopping of read replicas: 
            else if ('ReadReplicaSourceDBInstanceIdentifier' in resource) {
                console.log(`${resource.DBInstanceIdentifier} is running and available, but cannot be stopped because it is a read replica.`);
                return false;
            }
            // Normally, multi-AZ instances can be stopped. However, Microsoft SQL Server
            // databases are the exception and cannot be stopped if multi-AZ: 
            else if (resource.MultiAZ === true && sqlserverEngineRegex.test(resource.Engine || "")) {
                console.log(`${resource.DBInstanceIdentifier} is running and available, but cannot be stopped because stopping is not supported for multi-AZ Microsoft SQL Server databases.`)
                return false; 
            }
            else {
                return true; 
            }

        }
        else {
            return false;
        }
   
    }

    protected async stopResourcesAPI(): Promise<void> {

        let dbInstanceId: string;

        for (dbInstanceId of this.resourceIds) {
            let params: RDS.StopDBInstanceCommandInput = {
                DBInstanceIdentifier: dbInstanceId
            };
            await this.client.stopDBInstance(params);
        }        
    }
}