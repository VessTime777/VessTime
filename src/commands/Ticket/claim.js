import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticketPermissions.js';
import { claimTicket } from '../../services/ticket.js';
export default {
    data: new SlashCommandBuilder()
        .setName("claim")
        .setDescription("Claims an open ticket, assigning it to you.")
        .setDMPermission(false),

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

            if (!permissionContext.canManageTicket) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "В разрешении отказано",
                            "Вам нужен `Управление каналами` разрешение или настроенный `Роль билетного персонала` чтобы получить билеты.",
                        ),
                    ],
                });
            }

            const channel = interaction.channel;
            const result = await claimTicket(channel, interaction.user);
            
            if (!result.success) {
                logger.warn('Не удалось подать заявку на получение билета - недействительный канал получения билета', {
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
                        "Тикет был создан!",
                        "Вы успешно воспользовались этим билетом.",
                    ),
                ],
            });

            logger.info('Билет был успешно востребован', {
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                channelId: channel.id,
                channelName: channel.name,
                guildId: interaction.guildId,
                commandName: 'claim'
            });

        } catch (error) {
            logger.error('Ошибка при выполнении команды утверждения', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                channelId: interaction.channel?.id,
                guildId: interaction.guildId,
                commandName: 'claim'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'claim',
                source: 'ticket_claim_command'
            });
        }
    },
};



