'use strict';
import path from 'path'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url';

// 1. Leitura de Arquivo CNAB:
//
//   Permitir que o usuário forneça o caminho do arquivo CNAB pela linha de comando (CLI).
//   O campo do arquivo é opcional; caso não seja especificado, o programa deve informar ao usuário que será utilizado um arquivo padrão.
// 2. Busca por Segmentos:
//
//   Implementar a capacidade de buscar por segmentos específicos no arquivo CNAB.
//   Exibir o nome completo das empresas associadas ao segmento informado.
// 3. Pesquisa por Nome da Empresa:
//
//   Desenvolver uma funcionalidade que permita a busca por nome de empresa no arquivo CNAB.
//   Mostrar o nome completo da empresa, não apenas o fragmento usado na pesquisa.
//   Indicar a posição exata onde a empresa foi encontrada e informar a qual segmento ela pertence.
// 4. Exportação para JSON:
//
//   Criar um novo arquivo em formato JSON contendo as informações essenciais:
//   precisa ser uma nova opção no CLI
// Nome da empresa.
//   Endereço completo (incluindo avenida, rua e CEP).
// Posições no arquivo CNAB onde as informações foram localizadas.
//   Bônus
// O candidato tem total liberdade de mudar a estrutura atual desse projeto, a ideía é ver a criatividade para resolver esse problema.

import yargs from 'yargs'
import chalk from 'chalk'

const optionsYargs = yargs(process.argv.slice(2))
  .usage('Uso: $0 [options]')
  .option("f", { alias: "from", describe: "posição inicial de pesquisa da linha do Cnab", type: "number", demandOption: true })
  .option("t", { alias: "to", describe: "posição final de pesquisa da linha do Cnab", type: "number", demandOption: true })
  .option("s", { alias: "segmento", describe: "tipo de segmento", type: "string", demandOption: true })
  .option("f", { alias: "file", describe: "path do arquivo", type: "string", demandOption: false })
  .example('$0 -f 21 -t 34 -s p', 'lista a linha e campo que from e to do cnab')
  .argv;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { from, to, segmento, file } = optionsYargs

const defaultFilePath = `${__dirname}/cnabExample.rem`
const filePath = path.resolve( file ?? defaultFilePath)
// IS VALID ?

const sliceArrayPosition = (arr, ...positions) => [...arr].slice(...positions)

const messageLog = (segmento, segmentoType, from, to) => `
----- Cnab linha ${segmentoType} -----

posição from: ${chalk.inverse.bgBlack(from)}

posição to: ${chalk.inverse.bgBlack(to)}

item isolado: ${chalk.inverse.bgBlack(segmento.substring(from - 1, to))}

item dentro da linha P: 
  ${segmento.substring(0, from)}${chalk.inverse.bgBlack(segmento.substring(from - 1, to))}${segmento.substring(to)}

----- FIM ------
`

const log = console.log

console.time('leitura Async')

readFile(file, 'utf8')
  .then(file => {
    const cnabArray = file.split('\n')

    const cnabHeader = sliceArrayPosition(cnabArray, 0, 2)

    const [cnabBodySegmentoP, cnabBodySegmentoQ, cnabBodySegmentoR] = sliceArrayPosition(cnabArray, 2, -2)

    const cnabTail = sliceArrayPosition(cnabArray, -2)

    if (segmento === 'p') {
      log(messageLog(cnabBodySegmentoP, 'P', from, to))
      return
    }

    if (segmento === 'q') {
      log(messageLog(cnabBodySegmentoQ, 'Q', from, to))
      return
    }

    if (segmento === 'r') {
      log(messageLog(cnabBodySegmentoR, 'R', from, to))
      return
    }

  })
  .catch(error => {
    console.log("🚀 ~ file: cnabRows.js ~ line 76 ~ error", error)
  })
console.timeEnd('leitura Async')
