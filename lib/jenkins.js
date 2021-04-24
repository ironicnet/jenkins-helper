const yargs = require('yargs');
const base64 = require('base-64');
const fetch = require('node-fetch');
const { Toggle, Input, List, Confirm } = require('enquirer');

const getHeaders = (user, token) => ({
  'Content-Type': 'application/json',
  Authorization: `Basic ${base64.encode(`${user}:${token}`)}`,
});

const getJobDefinition = async ({
  host,
  controller,
  org,
  job,
  user,
  token,
}) => {
  var url = `https://${host}/${controller}/job/${org}/job/${job}/api/json`;
  return fetch(url, {
    headers: getHeaders(user, token),
  }).then((res) => res.json());
};

const postJobBuild = async ({
  host,
  controller,
  org,
  job,
  data,
  user,
  token,
}) => {
  const searchParams = new URLSearchParams();
  searchParams.append('delay', '0sec');
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((val) => {
        searchParams.append(key, val);
      });
    } else {
      searchParams.append(key, value);
    }
  });
  const fetchOptions = {
    method: 'post',
    headers: getHeaders(user, token),
  };
  var buildUrl = new URL(
    `https://${host}/${controller}/job/${org}/job/${job}/buildWithParameters`,
  );
  buildUrl.search = searchParams.toString();

  console.debug('Sending job build request...');
  return fetch(buildUrl, fetchOptions);
};

const mapParametersToQuestions = (parameters) => {
  return parameters
    .map((param) => {
      switch (param.type) {
        case 'StringParameterDefinition':
          return {
            name: param.name,
            prompt: new Input({
              type: 'input',
              message: `${param.name}`,
              initial:
                param.defaultParameterValue &&
                param.defaultParameterValue.value,
              footer: param.description,
            }),
          };
        case 'BooleanParameterDefinition':
          return {
            name: param.name,
            prompt: new Toggle({
              message: param.name,
              type: 'toggle',
              footer: param.description,
              initial:
                param.defaultParameterValue &&
                param.defaultParameterValue.value,
              enabled: 'Yes',
              disabled: 'No',
            }),
          };
        case 'PT_CHECKBOX':
          return {
            name: param.name,
            prompt: new List({
              type: 'list',
              message: `${param.name} (Comma separated)`,
              initial: param.defaultParameterValue
                ? param.defaultParameterValue.value
                : null,
              footer: param.description,
              //choices: ? // where do we get the choices from?
            }),
          };
        default:
          return null;
      }
    })
    .filter(Boolean);
};
const answerQuestions = async (questions, previousAnswers = null) => {
  const answers = {};
  try {
    for (let index = 0; index < questions.length; index++) {
      const { name, prompt } = questions[index];
      console.log(name, prompt.initial);
      if (previousAnswers && previousAnswers[name] != undefined) {
        prompt.initial = previousAnswers[name];
      }
      answers[name] = await prompt.run();
    }

    const executeAnswer = await new Confirm({
      name: 'confirm',
      message: `Is this data alright?:
  ${JSON.stringify(answers, null, 2)}`,
    }).run();
    if (executeAnswer) {
      return answers;
    }
  } catch {}
  return false;
};

const build = async (buildOptions) => {
  const { host, controller, org, job, user, token } = buildOptions;

  const projectDefinition = await getJobDefinition({
    host,
    controller,
    org,
    job,
    user,
    token,
  });
  const { property: properties, fullDisplayName,description, url } = projectDefinition;
  const { parameterDefinitions } = properties.find(
    (prop) => prop._class === 'hudson.model.ParametersDefinitionProperty',
  );
  var questions = mapParametersToQuestions(parameterDefinitions);
  console.info(`${fullDisplayName}
Link: ${url}
${description}`);
  let answers = await answerQuestions(questions, buildOptions);
  if (!answers) {
    console.log('Build request aborted');
    return 0;
  }

  postJobBuild({
    host,
    controller,
    org,
    job,
    user,
    token,
    data: answers,
  }).then((res) => {
    if (res.status === 201) {
      const queueItemUrl = res.headers.get('location');
      console.log('Job queued', queueItemUrl);
      fetch(`${queueItemUrl}api/json`, {
        headers: getHeaders(user, token),
      })
      .then(res => res.json())
      .then((data) => {
        const { executable } = data;
        if (executable) {
          console.info(executable.url);
        } else {
          console.log(data);
        }
      });
    } else {
      console.error('Job failed', res.status, res.statusText);
    }
  });
};
module.exports = {
  build,
}