'use strict';

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

import yargs from 'yargs';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CNAB_POSITIONS = {
  SEGMENT_INDEX: 13,
  COMPANY_NAME: {
    START: 33,
    END: 73
  },
  ADDRESS: {
    START: 73,
    END: 113
  },
  DISTRICT: {
    START: 113,
    END: 128
  },
  ZIP: {
    START: 128,
    END: 136
  },
  CITY: {
    START: 136,
    END: 151
  },
  STATE: {
    START: 151,
    END: 154
  }
};

/**
 * Helper function to slice an array at specific positions
 * @param {Array} arr - Array to slice
 * @param {...number} positions - Start and end positions
 * @returns {Array} - Sliced array
 */
const sliceArrayPosition = (arr, ...positions) => [...arr].slice(...positions);

/**
 * Creates a formatted log message for a CNAB line segment
 * @param {string} segmento - The CNAB segment line
 * @param {string} segmentoType - Type of segment (e.g., 'Q', 'P')
 * @param {number} from - Start position (1-based)
 * @param {number} to - End position (exclusive)
 * @param {string} caminho - File path (optional)
 * @returns {string} - Formatted message
 */
const messageLog = (segmento, segmentoType, from, to, caminho) => `
----- Cnab linha ${segmentoType} -----

posição from: ${chalk.inverse.bgBlack(from)}

posição to: ${chalk.inverse.bgBlack(to)}

item isolado: ${chalk.inverse.bgBlack(segmento.substring(from - 1, to))}

item dentro da linha ${segmentoType}: 
  ${segmento.substring(0, from - 1)}${chalk.inverse.bgBlack(segmento.substring(from - 1, to))}${segmento.substring(to)}

----- FIM ------
`;

/**
 * Creates a formatted log message for multiple CNAB segments
 * @param {Array<string>} segmentos - Array of CNAB segment lines
 * @param {string} segmentoType - Type of segment (e.g., 'Q', 'P')
 * @param {number} from - Start position (1-based)
 * @param {number} to - End position (exclusive)
 * @returns {string} - Formatted message
 */
const segmentMessageLog = (segmentos, segmentoType, from, to) => `
----- Cnab segmento ${segmentoType} -----
${segmentos.map(segmento => `${segmento.substring(0, from - 1)}${chalk.inverse.bgBlack(segmento.substring(from - 1, to))}${segmento.substring(to)}`).join('\n')}
----- FIM ------
`;

const log = console.log;

const setupCLI = () => {
  return yargs(process.argv.slice(2))
    .usage('Uso: $0 [options]')
    .option("f", {
      alias: "from",
      describe: "posição inicial de pesquisa da linha do Cnab",
      type: "number"
    })
    .option("t", {
      alias: "to",
      describe: "posição final de pesquisa da linha do Cnab",
      type: "number"
    })
    .option("s", {
      alias: "segmento",
      describe: "tipo de segmento",
      type: "string"
    })
    .option("b", {
      alias: "buscar",
      describe: "buscar empresa por nome ou segmento",
      type: "boolean"
    })
    .option("n", {
      alias: "nome",
      describe: "nome da empresa",
      type: "string"
    })
    .option("a", {
      alias: "arquivo",
      describe: "caminho do arquivo",
      type: "string"
    })
    .option("j", {
      alias: "json",
      describe: "exporta os dados para arquivo JSON",
      type: "string"
    })
    .check((argv) => {
      // Validate command arguments
      if (argv.buscar && (argv.nome || argv.segmento)) {
        return true;
      }
      if (argv.from && argv.to && argv.segmento) {
        return true;
      }
      if (argv.json) {
        return true;
      }
      throw new Error('Combinação de argumentos inválida. Use --help para ver as opções.');
    })
    .example('$0 -f 21 -t 34 -s p', 'lista a linha e campo que from e to do cnab')
    .example('$0 -b -s p', 'busca por segmento')
    .example('$0 -b -n "CAIXA"', 'busca por nome da empresa')
    .example('$0 -j "output.json"', 'exporta os dados para JSON')
    .example('$0 -a "caminho/do/arquivo.rem"', 'especifica o caminho do arquivo CNAB')
    .parserConfiguration({
      "camel-case-expansion": false,
      "short-option-groups": false
    })
    .argv;
};

/**
 * Parse a CNAB Q segment line into structured data with position information
 * @param {string} line - The CNAB line to parse
 * @returns {Object} - Structured data object with position information
 */
const parseCnabQSegmentLine = (line) => {
  return {
    nome: {
      value: line.slice(CNAB_POSITIONS.COMPANY_NAME.START, CNAB_POSITIONS.COMPANY_NAME.END).trim(),
      from: CNAB_POSITIONS.COMPANY_NAME.START,
      to: CNAB_POSITIONS.COMPANY_NAME.END
    },
    endereco: {
      value: line.slice(CNAB_POSITIONS.ADDRESS.START, CNAB_POSITIONS.ADDRESS.END).trim(),
      from: CNAB_POSITIONS.ADDRESS.START,
      to: CNAB_POSITIONS.ADDRESS.END
    },
    bairro: {
      value: line.slice(CNAB_POSITIONS.DISTRICT.START, CNAB_POSITIONS.DISTRICT.END).trim(),
      from: CNAB_POSITIONS.DISTRICT.START,
      to: CNAB_POSITIONS.DISTRICT.END
    },
    cep: {
      value: line.slice(CNAB_POSITIONS.ZIP.START, CNAB_POSITIONS.ZIP.END),
      from: CNAB_POSITIONS.ZIP.START,
      to: CNAB_POSITIONS.ZIP.END
    },
    cidade: {
      value: line.slice(CNAB_POSITIONS.CITY.START, CNAB_POSITIONS.CITY.END).trim(),
      from: CNAB_POSITIONS.CITY.START,
      to: CNAB_POSITIONS.CITY.END
    },
    estado: {
      value: line.slice(CNAB_POSITIONS.STATE.START, CNAB_POSITIONS.STATE.END),
      from: CNAB_POSITIONS.STATE.START,
      to: CNAB_POSITIONS.STATE.END
    }
  };
};

/**
 * Export CNAB data to JSON file
 * @param {Array<string>} data - Array of CNAB lines to parse and export
 * @param {string} outPath - Output file path
 * @returns {Promise<string>} - Success message
 */
const exportToJson = async (data, outPath) => {
  const parsedData = data.map(line => parseCnabQSegmentLine(line));
  await fs.writeFile(outPath, JSON.stringify(parsedData, null, 2), 'utf8');
  return `Arquivo JSON exportado para: ${outPath}`;
};

/**
 * Read and parse CNAB file
 * @param {string} filePath - Path to CNAB file
 * @returns {Promise<Object>} - Parsed CNAB data
 */
const readCnabFile = async (filePath) => {
  const file = await fs.readFile(filePath, 'utf8');
  const cnabArray = file.split('\n');

  // Split the CNAB file into logical sections
  return {
    full: cnabArray,
    header: sliceArrayPosition(cnabArray, 0, 2),
    body: sliceArrayPosition(cnabArray, 2, -2),
    tail: sliceArrayPosition(cnabArray, -2)
  };
};

/**
 * Search for specific positions in a segment
 * @param {Array<string>} cnabBody - Body section of CNAB file
 * @param {string} segmentoType - Type of segment to search for
 * @param {number} from - Start position
 * @param {number} to - End position
 * @param {string} arquivoPath - File path (optional)
 */
const searchSegmentPositions = (cnabBody, segmentoType, from, to, arquivoPath) => {
  const register = cnabBody.find(line => line[CNAB_POSITIONS.SEGMENT_INDEX] === segmentoType);
  if (register) {
    log(messageLog(register, segmentoType, from, to, arquivoPath));
  } else {
    log(chalk.yellow('Nenhuma linha encontrada para o tipo de segmento informado.'));
  }
};

/**
 * Search by segment type
 * @param {Array<string>} cnabBody - Body section of CNAB file
 * @param {string} segmentoType - Type of segment to search for
 */
const searchBySegmentType = (cnabBody, segmentoType) => {
  const foundSegment = cnabBody.filter((line) => line[CNAB_POSITIONS.SEGMENT_INDEX] === segmentoType);
  if (foundSegment.length) {
    log(segmentMessageLog(
      foundSegment,
      segmentoType,
      CNAB_POSITIONS.SEGMENT_INDEX + 1,
      CNAB_POSITIONS.SEGMENT_INDEX + 1
    ));
  } else {
    log(chalk.yellow('Nenhum segmento encontrado.'));
  }
};

/**
 * Search by company name
 * @param {Array<string>} cnabBody - Body section of CNAB file
 * @param {string} companyName - Company name to search for
 * @param {string} arquivoPath - File path (optional)
 */
const searchByCompanyName = (cnabBody, companyName, arquivoPath) => {
  const foundCompanies = cnabBody.filter(
    (line) =>
      line[CNAB_POSITIONS.SEGMENT_INDEX] === 'Q' &&
      line.slice(CNAB_POSITIONS.COMPANY_NAME.START, CNAB_POSITIONS.COMPANY_NAME.END)
        .includes(companyName.toUpperCase())
  );

  foundCompanies.forEach(line => {
    const endIndex = line.slice(CNAB_POSITIONS.COMPANY_NAME.START, CNAB_POSITIONS.COMPANY_NAME.END).trim().length;
    log(messageLog(
      line,
      'Q',
      CNAB_POSITIONS.COMPANY_NAME.START + 1,
      CNAB_POSITIONS.COMPANY_NAME.START + endIndex,
      arquivoPath
    ));
  });

  if (foundCompanies.length === 0) {
    log(chalk.yellow('Nenhuma empresa encontrada com esse nome.'));
  }
};

/**
 * Export data to JSON file
 * @param {Array<string>} cnabArray - Full CNAB file as array of lines
 * @param {string} jsonPath - Path to output JSON file
 */
const exportToJsonFile = async (cnabArray, jsonPath) => {
  try {
    const data = cnabArray.filter(line => line[CNAB_POSITIONS.SEGMENT_INDEX] === 'Q');
    const result = await exportToJson(data, jsonPath);
    console.log(chalk.green(result));
  } catch (error) {
    console.error(chalk.red('Erro ao exportar para JSON:'), error.message);
  }
};

/**
 * Process the file based on command line arguments
 * @param {Object} options - Command line options
 * @param {Object} cnabData - Parsed CNAB data
 */
async function processCommandArguments(options, cnabData) {
  const { from, to, segmento, buscar, nome, json, arquivo } = options;
  const segmentoType = segmento ? segmento.toUpperCase() : undefined;

  if (from && to && segmento) {
    searchSegmentPositions(cnabData.body, segmentoType, from, to, arquivo);
  }

  if (buscar) {
    if (segmento) {
      searchBySegmentType(cnabData.body, segmentoType);
    }

    if (nome) {
      searchByCompanyName(cnabData.body, nome, arquivo);
    }
  }

  if (json) {
    await exportToJsonFile(cnabData.full, json);
  }
}

async function main() {
  console.time('Tempo total');

  try {
    const options = setupCLI();

    const defaultFilePath = `${__dirname}/cnabExample.rem`;
    const filePath = options.arquivo ? path.resolve(options.arquivo) : defaultFilePath;

    const cnabData = await readCnabFile(filePath);

    await processCommandArguments(options, cnabData);
  } catch (error) {
    console.error(chalk.red('Erro ao processar o arquivo:'), error.message);
  }

  console.timeEnd('Tempo total');
}

main();
