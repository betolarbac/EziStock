import { Telegraf } from 'telegraf';
import { visualizarEstoque } from './estoque';
import { atualizarQuantidade } from './quantidade';
import { cancelarProduto } from './cancelar';
import { vencendo } from './vencendo';
import { cadastrarProdutoPorTexto } from './registrar';
import { handleSubscription } from './premium';

export function setupCommands(bot: Telegraf) {
  bot.hears(/^Cadastrar:/i, cadastrarProdutoPorTexto);
  bot.command('estoque', visualizarEstoque);
  bot.hears(/^Adicionar \d+ ao produto:/i, atualizarQuantidade);
  bot.hears(/^Remover \d+ do produto:/i, atualizarQuantidade);
  bot.hears(/^Cancelar produto:/i, cancelarProduto);
  bot.command('vencendo', vencendo);
  bot.command('assinar', handleSubscription)
}