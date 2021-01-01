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
* RDS Aurora clusters
* RDS Databases (see **RDS Support**)
    

At this time, the Lambda code only applies stop actions to resources within the same region. 

## RDS Support

RDS can be a bit tricky depending on database engine and configuration. 

There are a few known gaps in my RDS stopper implementation, and possibly others I haven't identified:

* Aurora instance-based databases are supported

* Aurora Serverless is not applicable... and I haven't added code to ignore Aurora Serverless... so an error would probably be thrown when the stop command is issues. This needs to be fixed.

* Microsoft SQL Server cannot be stopped if it is multi-AZ. I have not added logic to ignore such databases, so an error would probably be thrown. 

* In the `/rds-stopper.ts` file, I had to comment out the code that searches for Oracle tags. For reasons not worth going in to, Oracle is not available in my AWS account so I had to remove these values. If you're running an Oracle database, you would need to uncomment the oracle engines in the tag filters and test accordingly. 

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