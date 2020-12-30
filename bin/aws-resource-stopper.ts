#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsResourceStopperStack } from '../lib/aws-resource-stopper-stack';

const app = new cdk.App();
new AwsResourceStopperStack(app, 'AwsResourceStopperStack');
