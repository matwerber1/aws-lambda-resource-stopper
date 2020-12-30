# AWS Lambda Resource Stopper

This project contains the source code for an AWS Lambda function that will stop certain resource types (that you configure) if they are **not** tagged with a tag of `KeepRunning=true`. 

The idea is you would set this Lambda up to run on a schedule, such as nightly at 12 AM, in personal or experimental AWS accounts to turn off your resources. 

## Warning

Given the fact that this Lambda will indiscriminately stop resources, you of course should **not** run this in an account that has resources that you do not want to stop without thoroughly testing or modifying the code in a test account or region, and/or without first tagging your resources with `KeepRunning=true` (note - tags are case-sensitive).

## Status

This project currently supports: 

* EC2 instances
* SageMaker notebooks
* Neptune clusters

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