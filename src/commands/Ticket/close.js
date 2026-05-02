import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticketPermissions.js';
import { closeTicket } from '../../services/ticket.js';
export default {
    data: new SlashCommandBuilder()
        .setName("закрывать")
        .setDescription("Закрывает текущий билет.")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("причина")
                .setDescription("Причина закрытия билета.")
                .setRequired(false),
        ),

    async execute(interaction, guildConfig, client) {
        try {
            
            const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred) {
                return;
            }

            const permissionContext = await getTicketPermissionContext({ client, interaction });
            if (!permissionContext.ticketData) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "Это не канал продажи билетов",
                            "Эта команда может быть использована только в действующем канале подачи заявок.",
                        ),
                    ],
                });
            }

            if (!permissionContext.canCloseTicket) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "В разрешении отказано",
                            "Чтобы закрыть этот запрос, вам необходимо разрешение 'Управлять каналами', настроенная 'Роль сотрудника support' или быть создателем заявки.",
                        ),
                    ],
                });
            }

            const channel = interaction.channel;
            const reason =
                interaction.options?.getString("reason") ||
                "Closed via command without a specific reason.";

            const result = await closeTicket(channel, interaction.user, reason);
            
            if (!result.success) {
                logger.warn('Не удалось закрыть тикет - недействительный канал подачи тикета', {
                    userId: interaction.user.id,
                    channelId: channel.id,
                    guildId: interaction.guildId,
                    error: result.error
                });
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "Это не канал продажи билетов",
                            result.error || "Эта команда может быть использована только в действующем канале подачи заявок.",
                        ),
                    ],
                });
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "Билет закрыт!",
                        "Этот запрос был успешно закрыт.",
                    ),
                ],
            });

            logger.info('Ticket closed successfully', {
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                channelId: channel.id,
                channelName: channel.name,
                guildId: interaction.guildId,
                reason: reason,
                commandName: 'close'
            });

        } catch (error) {
            logger.error('Error executing close command', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                channelId: interaction.channel?.id,
                guildId: interaction.guildId,
                commandName: 'close'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'close',
                source: 'ticket_close_command'
            });
        }
    },
};



