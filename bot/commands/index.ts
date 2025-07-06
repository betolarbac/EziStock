import { Telegraf } from 'telegraf';
import { cadastrarProdutoIA } from './registrar';
import { visualizarEstoque } from './estoque';
import { atualizarQuantidade } from './quantidade';
import { cancelarProduto } from './cancelar';
import { vencendo } from './vencendo';

export function setupCommands(bot: Telegraf) {
  bot.hears(/^Cadastrar:/i, cadastrarProdutoIA);
  bot.command('estoque', visualizarEstoque);
  bot.hears(/^Adicionar \d+ ao produto:/i, atualizarQuantidade);
  bot.hears(/^Remover \d+ do produto:/i, atualizarQuantidade);
  bot.hears(/^Cancelar produto:/i, cancelarProduto);
  bot.command('vencendo', vencendo);
}