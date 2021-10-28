// Description:
//   Hubot extension that will hear/respond to hey janet commands
//
// Author:
//   Matt Erickson (MutMatt) Matt@MattErickson.me
//
// Configuration:
//   None
//
// Dependencies:
//   None
//
// Commands:
//   hubot respond to {a text} with {value} - Creates a respond to {a text} and responds with value {value}
//   hubot here respond to {a text} with {value} - Creates a respond to {a text} and responds with value {value} but in the current room
//   hubot delete respond to {a text} - Deletes respond to {a text}
//   hubot from here delete respond to {a text} - Deletes respond to {a text} from the current room
//   hubot list responds - Lists all responds

import { ChatPostMessageArguments, ConversationsListArguments } from "@slack/web-api";
import  { CronJob } from "cron";
import moment from 'moment';
import { app } from "../app";

//const procVars = helpers.getProcessVariables(process.env);
const warningMessage = 'This channel is inactive and will be exterminated :exterminate: shortly if no activity is recorded';


let cronTiming = '0 */6 * * *';
let daysSinceLastInteraction = 30;
if (process.env.DEBUG === 'true') {
  cronTiming = '*/1 * * * *';
  daysSinceLastInteraction = 3;
}

console.debug(`register the channel cleanup cron days since ${daysSinceLastInteraction} cron ${cronTiming}`);
const job: CronJob = new CronJob(cronTiming, async () => {
  try {
    console.debug(`cron triggered for robot`);
    const { channels } = await app.client.conversations.list({ exclude_archived: true } as ConversationsListArguments);
    if (!channels) {
      console.error("no channels found");
      return;
    }
    console.debug("Found these channels", channels.map((channel) => channel.id).join(', '));

    const channelsToArchive: string[] = [];
    const channelsToWarn: string[] = [];
    const daysAgo = moment().subtract(daysSinceLastInteraction, 'days').unix();
    for (const channel of channels) {
      if (!channel.id) {
        console.debug(`Missing channel id ${JSON.stringify(channel)}`);
        continue;
      }

      try {
        await app.client.conversations.join({ channel: channel.id });
      } catch (e: any) {
        
        console.error(`Couldn't join channel #${channel.id} ${e.message}`);
      }

      console.debug(`Trying to find history for ${channel.id} with the oldest message ${moment().subtract(daysSinceLastInteraction, 'days')} days ago`);
      const { messages } = await app.client.conversations.history({ channel: channel.id, oldest: daysAgo.toString() });
      if (!messages) {
        console.error("no messages found");
        return;
      }

      console.debug(`Got the history for ${channel.name} there are ${messages.length} messages since ${
        moment().subtract(daysSinceLastInteraction, 'days')
      }`);//`, E.G:\n ${messages.map((message) => message.text).join('\n')}`);
      const hubotWarningMessages = messages.filter((message) => {
        return message.text && 
        (message.text === warningMessage || message.text.indexOf('has joined the channel') !== -1)
      });
      const nonHubotMessages = messages.filter((message) => {
        return message.text &&
        (message.text != warningMessage && message.text.indexOf('has joined the channel') === -1)
      });
      
      if (nonHubotMessages.length <= 0 && hubotWarningMessages.length > 5) {
        console.debug(`This channel has been found to have no user messages in the last ${daysSinceLastInteraction} days`);
        channelsToArchive.push(channel.id);
      }
      if (nonHubotMessages.length <= 0) {
        channelsToWarn.push(channel.id);
      }
    }



    for (const warnTheChannel of channelsToWarn) {
      try { 
        const result = await app.client.chat.postMessage({ channel: warnTheChannel, text: warningMessage } as ChatPostMessageArguments)
      } catch (e: any) {
        console.error(`Couldn't message channel #${warnTheChannel} ${e.message}`, e);
      }
    }

    for (const channelToArchive of channelsToArchive) {
      try {
        await app.client.conversations.archive({ channel: channelToArchive });
      } catch (e: any) {
        console.error(`Couldn't archive channel #${channelToArchive} ${e.message}`, e);
      }
    }
  } catch (er: any) {
    console.error(`An error occurred in the cron ${er.message}`, er);
  }
}, null, true, 'America/Chicago');

job.start();
console.log("start the job", job.nextDates())