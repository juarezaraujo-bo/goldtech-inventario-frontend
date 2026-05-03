/** Mapeamento de geração Intel → faixa de anos de lançamento */
const INTEL_GEN_YEARS = {
  1: '2008/2009', 2: '2010/2011', 3: '2011/2012', 4: '2013/2014',
  5: '2014/2015', 6: '2015/2016', 7: '2016/2017', 8: '2017/2018',
  9: '2018/2019', 10: '2019/2020', 11: '2020/2021', 12: '2021/2022',
  13: '2022/2023', 14: '2023/2024', 15: '2024/2025'
};

export function detectIntelGeneration(cpuName) {
  if (!cpuName) return null;
  const cpu = cpuName.toLowerCase();

  const genLabelMatch = cpu.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+gen\b/);
  if (genLabelMatch) return parseInt(genLabelMatch[1], 10);

  const match = cpu.match(/i[3579][-\s](\d{4,5})/);
  if (!match) return null;
  const modelNumber = match[1];
  const twoDigitGeneration = parseInt(modelNumber.substring(0, 2), 10);

  if (modelNumber.length === 5 || (modelNumber.length === 4 && twoDigitGeneration >= 10 && twoDigitGeneration <= 15)) {
    return twoDigitGeneration;
  }

  return parseInt(modelNumber.substring(0, 1), 10);
}

export function getCpuEstimatedYear(cpuName) {
  const gen = detectIntelGeneration(cpuName);
  if (gen !== null && INTEL_GEN_YEARS[gen]) return INTEL_GEN_YEARS[gen];
  return 'Ano estimado não identificado';
}

export function getBiosYear(biosDate) {
  if (!biosDate) return 'Ano aproximado da placa-mãe não identificado';
  const yearMatch = biosDate.match(/\b(20\d{2}|19\d{2})\b/);
  if (yearMatch) return yearMatch[1];
  return 'Ano aproximado da placa-mãe não identificado';
}

export function parseRamGB(ramStr) {
  if (!ramStr) return 0;
  const s = ramStr.toString().toLowerCase().trim();
  const match = s.match(/(\d+(\.\d+)?)/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  if (s.includes('mb') || (!s.includes('gb') && val >= 512)) return Math.round(val / 1024);
  return Math.round(val);
}

export function classifyObsolescence(equipment) {
  const cpuName = equipment.processador || '';
  const cpu = cpuName.toLowerCase();
  const ramGB = parseRamGB(equipment.memoria_ram);
  const motivos = [];
  let cpuStatus = 'normal';
  let ramStatus = 'normal';

  const gen = detectIntelGeneration(cpu);
  const cpuYear = getCpuEstimatedYear(cpuName);
  const biosYear = getBiosYear(equipment.bios_date);

  if (gen !== null) {
    if (gen < 7) {
      cpuStatus = 'critico';
      motivos.push(`Processador ${cpuName} identificado como ${gen}ª geração Intel (${cpuYear}), inferior ao mínimo recomendado de 7ª geração. Substituição imediata indicada.`);
    } else if (gen >= 7 && gen <= 10) {
      cpuStatus = 'atencao';
      motivos.push(`Processador ${cpuName} identificado como ${gen}ª geração Intel (${cpuYear}). Faixa de atenção (7ª–10ª): upgrade para geração 11ª ou superior recomendado.`);
    }
  } else if (
    cpu.includes('celeron') || cpu.includes('pentium') ||
    cpu.includes('amd fx') || (cpu.includes('amd a') && /amd a\d/.test(cpu))
  ) {
    cpuStatus = 'critico';
    motivos.push(`Processador legado detectado: "${cpuName}" (Celeron / Pentium / AMD FX / AMD A-series). Inadequado para uso corporativo moderno.`);
  }
  // CPUs sem geração identificável não geram alerta automático

  if (ramGB > 0) {
    if (ramGB < 4) {
      ramStatus = 'critico';
      motivos.push(`Memória RAM de ${ramGB}GB inferior ao mínimo de 4GB. Substituição ou upgrade imediato recomendado.`);
    } else if (ramGB >= 4 && ramGB < 8) {
      ramStatus = 'atencao';
      motivos.push(`Memória RAM de ${ramGB}GB dentro da faixa de atenção (4–8GB). Recomendado upgrade para 8GB ou superior.`);
    }
  }

  const LEVELS = { critico: 2, atencao: 1, normal: 0 };
  const worstLevel = Math.max(LEVELS[cpuStatus] || 0, LEVELS[ramStatus] || 0);

  let status_obsolescencia, acao_recomendada;
  if (worstLevel >= 2) { status_obsolescencia = 'critico'; acao_recomendada = 'Substituição imediata do equipamento'; }
  else if (worstLevel === 1) { status_obsolescencia = 'atencao'; acao_recomendada = 'Recomendado upgrade de hardware'; }
  else { status_obsolescencia = 'normal'; acao_recomendada = 'Equipamento adequado'; }

  return { status_obsolescencia, acao_recomendada, motivos, cpu_generation: gen, cpu_estimated_year: cpuYear, bios_year: biosYear };
}

export function getObsolescenceBadge(status) {
  switch (status) {
    case 'critico': return { label: 'CRÍTICO', bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' };
    case 'atencao': return { label: 'ATENÇÃO', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' };
    default: return { label: 'NORMAL', bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.3)' };
  }
}
