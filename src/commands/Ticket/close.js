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
        .setName("close")
        .setDescription("Закрывает текущий билет.")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("reason")
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
                            "Это не канал билетов",
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
                            "Вам требуется разрешение `Управлять каналами`, настроенное `Роль билетного персонала`, или быть создателем заявки, чтобы закрыть эту заявку.",
                        ),
                    ],
                });
            }

            const channel = interaction.channel;
            const reason =
                interaction.options?.getString("reason") ||
                "Закрыто с помощью команды без конкретной причины.";

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
                            "Это не канал билетов",
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

            logger.info('Билет успешно закрыт', {
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                channelId: channel.id,
                channelName: channel.name,
                guildId: interaction.guildId,
                reason: reason,
                commandName: 'close'
            });

        } catch (error) {
            logger.error('Ошибка при выполнении команды закрытия', {
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
