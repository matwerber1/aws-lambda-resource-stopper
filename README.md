# AWS Lambda Resource Stopper

This project contains an AWS CDK project that deploys a Lambda function that is automatically invoked once per day at 1 AM. This function will stop any supported running resources if they are **not** tagged with `KeepRunning=true`.

## Warning

Given the fact that this Lambda will indiscriminately stop resources, you of course should **not** run this in an account that has resources that you do not want to stop without thoroughly testing or modifying the code in a test account or region, and/or without first tagging your resources with `KeepRunning=true` (note - tags are case-sensitive).

## Supported resources

This project currently supports: 

* EC2 instances
* SageMaker notebooks
* Neptune clusters
* Redshift clusters

At this time, the Lambda code only applies stop actions to resources within the same region. 

## Deployment

Complete deployment instructions are not yet written, but high-level, can follow the steps below:

1. Transpile the Lambda Typescript to Javascript/NodeJS:

    ```
    cd lib/lambda/stopper-function
    npm run build
    ```

2. Deploy the Lambda + CloudWatch Event via the AWS CDK. Be sure to run these commands from the root directory of this project:

    ```
    cdk deploy
    ```