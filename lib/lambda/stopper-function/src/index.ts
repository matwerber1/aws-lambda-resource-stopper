import * as CredentialProvider from '@aws-sdk/credential-provider-node';
import * as STS from '@aws-sdk/client-sts';
import { ResourceStopper, ResourceStopperProps } from './resource-stopper';
import { Ec2Stopper } from './ec2-stopper';
import { SageMakerStopper } from './sagemaker-stopper';
import { NeptuneStopper } from './neptune-stopper';


export const handler = async (event: any = {}): Promise<any> => {
    
    let response:string = "";

    try {

        let awsClientConfig = getAwsClientConfig();

        let accountId = await getAccountId(awsClientConfig);
        
        let resourceTypesToStop:string[] = [
            'ec2',
            'sagemaker',
            'neptune'
        ];

        for (const resourceTypeToStop of resourceTypesToStop) {
            
            console.log(`#==== ${resourceTypeToStop} ====#`);

            let stopper:ResourceStopper;
    
            let params:ResourceStopperProps = {
                accountId: accountId,
                dryRun: false,
                awsClientConfig: awsClientConfig
            };

            switch (resourceTypeToStop) {
                case 'ec2':
                    stopper = new Ec2Stopper(params);
                    break;
                case 'sagemaker': 
                    stopper = new SageMakerStopper(params);
                    break;
                case 'neptune':
                    stopper = new NeptuneStopper(params);
                    break;
                default: 
                    throw new Error(`Unsupported resource type: ${resourceTypeToStop}`);
            }

            await stopper.stopResources();
            
            console.log("\n");
        
        }

        response = 'Done!';
        
    }
    catch(error) {
        response = error;
    }
    console.log(response);
    return response;
}

/**
 * If running Lambda locally, we need to tell our SDK what our AWS credentials are,
 * or where to find them. In my case, I'm using an AWS CLI profile named 'ctt-experiment', 
 * but you would of course change this. If this code is running in a Lambda in AWS, the SDK
 * will automatically assume the IAM role associated with the Lambda. The same is true
 * for the AWS region: 
 */
function getAwsClientConfig() {
    
    if (process.env.LOCAL_AWS === "TRUE") {
        
        let localConfig = {
            region: 'us-west-2',
            credentials: CredentialProvider.defaultProvider({ profile: 'ctt-experiment'})
        };
    
        return localConfig;
    }
    else {
        // When running in the cloud, we don't need to specify any credentials:
        return {};
    }
    
}


// We need the AWS account number to be able to determine ARNs of resources to stop: 
async function getAccountId(clientConfig:object): Promise<string> {

    let sts = new STS.STS(clientConfig);
    let response = await sts.getCallerIdentity({});
    return response.Account || '';

}