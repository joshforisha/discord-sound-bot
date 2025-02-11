# Discord Sound Bot

A self-hosted soundboard Discord app, with graphical interface for easy controls.

## Setup

You should create an application in the [Discord Developer Portal](https://discord.com/developers/applications) and copy its *token* from the application's bot page. You'll also need to invite your bot into the Discord channels in which you want to have it active.

1. Run `npm install` to install dependencies
2. Create a `.env` file containing the text `BOT_TOKEN=` followed by the bot's token code
3. Put audio files into the `sounds/` directory
4. Do one of the following:
  - `npm run build` to build the application as an executable in `dist/`
  - `npm start` to run the application in-place
