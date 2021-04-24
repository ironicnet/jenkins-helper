#!/usr/bin/env node
const yargs = require('yargs');
const { build } = require('../lib/jenkins')
const argv = yargs
  .command(
    ['$0', 'build'],
    'Builds the job with the required parameters',
    {
      org: {
        alias: 'g',
        description: 'The organization of the job',
        type: 'string',
        demandOption: true,
      },
      job: {
        description: 'The name of the job',
        type: 'string',
        demandOption: true,
      },
    },
    build,
  )
  .env('JENKINS')
  .option('host', {
    alias: 'o',
    description: 'The hostname of jenkins',
    type: 'string',
    demandOption: false,
  })
  .option('controller', {
    alias: 'c',
    description: 'The controller of jenkins to use',
    type: 'string',
    demandOption: false,
  })
  .help()
  .alias('help', 'h')
  .option('user', {
    description: 'The user used for authentication',
    type: 'string',
    demandOption: true,
  })
  .option('token', {
    description: 'The token used for authentication',
    type: 'string',
    demandOption: true,
  }).argv;
