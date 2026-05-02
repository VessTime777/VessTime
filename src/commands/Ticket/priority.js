import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticketPermissions.js';
import { updateTicketPriority } from '../../services/ticket.js';

export default {
    data: new SlashCommandBuilder()
        .setName("priority")
        .setDescription("Sets the priority level for the current support ticket.")
        .addStringOption((option) =>
            option
                .setName("level")
                .setDescription("The priority level for the ticket.")
                .setRequired(true)
                .addChoices(
                    { name: "🔴 Неотложный", value: "Неотложный" },
                    { name: "🟠 Высокий", value: "Высокий" },
                    { name: "🟡 Средний", value: "Средний" },
                    { name: "🟢 Низкий", value: "Низкий" },
                    { name: "⚪ Никто", value: "Никто" },
                ),
            )
        .setDMPermission(false),
    category: "Ticket",

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
                            "Вам нужен `Управление каналами` разрешение или настроенный `Роль билетного support` чтобы изменить приоритет заявки, выполните следующие действия.",
                        ),
                    ],
                });
            }

            const priorityLevel = interaction.options.getString("level");
            const result = await updateTicketPriority(interaction.channel, priorityLevel, interaction.user);
            
            if (!result.success) {
                logger.warn('Не удалось выполнить приоритетное обновление - недействительный канал подачи заявок', {
                    userId: interaction.user.id,
                    channelId: interaction.channel.id,
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
                        "Priority Updated",
                        `Ticket priority set to **${priorityLevel.toUpperCase()}**.`,
                    ),
                ],
            });

            logger.info('Приоритет заявки успешно обновлен', {
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                channelId: interaction.channel.id,
                channelName: interaction.channel.name,
                guildId: interaction.guildId,
                priority: priorityLevel,
                commandName: 'priority'
            });

        } catch (error) {
            logger.error('Ошибка при выполнении приоритетной команды', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                channelId: interaction.channel?.id,
                guildId: interaction.guildId,
                commandName: 'priority'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'priority',
                source: 'ticket_priority_command'
            });
        }
    },
};




