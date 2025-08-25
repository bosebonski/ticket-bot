const { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType } = require('discord.js');
const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("✅ Bot is running!"));
app.listen(3000, () => console.log("🌍 Express server ready"));
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logger = require('./utils/logger');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize collections
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        logger.log(`⚠️ The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Load button handler
const buttonHandler = require('./handlers/buttonHandler');

// Bot ready event
client.once('ready', async () => {
    logger.log(`✅ ${client.user.tag} is online and ready!`);
    
    // Set bot status
    client.user.setPresence({
        activities: [{ name: 'Ticket Support | /panel', type: ActivityType.Watching }],
        status: 'online',
    });

    // Register slash commands
    const commands = [];
    client.commands.forEach(command => {
        commands.push(command.data.toJSON());
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        logger.log('🔄 Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );

        logger.log('✅ Successfully reloaded application (/) commands.');
    } catch (error) {
        logger.error('Error refreshing commands:', error);
    }
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            logger.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            logger.error('Error executing command:', error);
            const reply = { content: 'There was an error while executing this command!', ephemeral: true };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    } else if (interaction.isButton()) {
        // Handle button interactions
        await buttonHandler.handleButtonInteraction(interaction, client);
    }
});

// Error handling
client.on('error', error => {
    logger.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
});

// Keep bot alive (for 24/7 uptime)
setInterval(() => {
    logger.log('🔄 Heartbeat - Bot is alive');
}, 300000); // Every 5 minutes

// Login to Discord
const token = process.env.DISCORD_TOKEN;
if (!token) {
    logger.error('❌ DISCORD_TOKEN not found in environment variables!');
    process.exit(1);
}

client.login(token).catch(error => {
    logger.error('Failed to login:', error);
    process.exit(1);
});
