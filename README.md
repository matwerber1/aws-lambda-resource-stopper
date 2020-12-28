# AWS Lambda Resource Stopper

This project contains the source code for an AWS Lambda function that will stop certain resource types (that you configure) if they are **not** tagged with a tag of `KeepRunning=true`. 

The idea is you would set this Lambda up to run on a schedule, such as nightly at 12 AM, in personal or experimental AWS accounts to turn off your resources. 

## Warning

Given the fact that this Lambda will indiscriminately stop resources, you of course should **not** run this in an account that has resources that you do not want to stop without thoroughly testing or modifying the code in a test account or region, and/or without first tagging your resources with `KeepRunning=true` (note - tags are case-sensitive).

## Status

This project currently supports: 

* EC2 instances
* SageMaker notebooks

At this time, the Lambda code only applies stop actions to resources within the same region. 

## Deployment

Complete deployment instructions are not yet written, but high-level, you would install the Typescript CLI and use the `tsc` command to transpile the `./src/` Typescript source into runnable Javascript in the `./dist/` directory.


Then, zip and upload all assets in the `./dist/` directory as a Lambda function and be sure to grant the Lambda with required permissions, which include but are not limited to: 

* `ec2:DescribeInstances`
* `ec2:DescribeTags`
* `ec2:StopInstances`
* `sagemaker:ListNotebookInstances`
* `sagemaker:ListTags`
* `sagemaker:StopNotebookInstance`