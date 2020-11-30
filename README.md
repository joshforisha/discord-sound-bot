# Discord Sound Bot

A self-hosted soundboard Discord app, with graphical interface for easy controls.

## Setup

You should create an application in the [Discord Developer Portal](https://discord.com/developers/applications) and copy its *token* from the application's bot page. You'll also need to invite your bot into the Discord channels in which you want to have it active.

1. Run `npm install` to install dependencies
2. Create a `.env` file containing the text `BOT_TOKEN=` followed by the bot's token
3. Put audio files into the `sounds/` directory
4. Run `npm run build` to build the client UI into `dist/`
5. Run `npm start` to start both the server and the UI application
