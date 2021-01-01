import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';
import * as targets from '@aws-cdk/aws-events-targets';
import { Rule, Schedule } from '@aws-cdk/aws-events';
import * as path from 'path';


export class AwsResourceStopperStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const resourceStopperFunction = new lambda.Function(this, 'ResourceStopperFunction', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/stopper-function/dist')),
      timeout: cdk.Duration.seconds(30),
      initialPolicy: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: ["*"],
          actions: [
            'ec2:DescribeInstances',
            'ec2:DescribeTags',
            'ec2:StopInstances',
            'sagemaker:ListNotebookInstances',
            'sagemaker:ListTags',
            'sagemaker:StopNotebookInstance',
            'rds:DescribeDBClusters',
            'rds:ListTagsForResource',
            'rds:StopDBCluster',
            'rds:DescribeDBInstances',
            'rds:StopDBInstance',
            'redshift:DescribeClusters',
            'redshift:DescribeTags',
            'redshift:PauseCluster',
          ]
        })
      ]
    });

    // Invoke our Lambda at 1 AM every day: 
    const rule = new Rule(this, 'ScheduledEventToInvokeStopperLambda', {
      schedule: Schedule.cron({ minute: '0', hour: '1' }),
     });

    rule.addTarget(new targets.LambdaFunction(resourceStopperFunction));

  }
}
