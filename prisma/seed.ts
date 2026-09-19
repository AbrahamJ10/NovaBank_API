import { PrismaClient, BillerCategory } from "@prisma/client";

const prisma = new PrismaClient();

type SeedBiller = {
  key: string;
  name: string;
  category: BillerCategory;
};

const CATEGORY_META: Record<BillerCategory, { icon: string; iconBg: string; iconFg: string; fieldLabel: string; fieldPlaceholder: string }> = {
  LUZ: { icon: "bolt", iconBg: "#FFF9EC", iconFg: "#B07D07", fieldLabel: "Número de suministro", fieldPlaceholder: "Ej. 0084 2210" },
  AGUA: { icon: "water-drop", iconBg: "#EAF3FF", iconFg: "#2C6FD1", fieldLabel: "Número de suministro", fieldPlaceholder: "Ej. 0021 8842" },
  GAS: { icon: "local-gas-station", iconBg: "#FDEDE7", iconFg: "#B45B2E", fieldLabel: "Número de suministro", fieldPlaceholder: "Ej. 0456 1290" },
  MOVIL: { icon: "smartphone", iconBg: "#F4F6F9", iconFg: "#33414F", fieldLabel: "Número de línea", fieldPlaceholder: "Ej. 987 214 550" },
  CABLE: { icon: "wifi", iconBg: "#FFF1E8", iconFg: "#D2691E", fieldLabel: "Código de cliente", fieldPlaceholder: "Ej. 55021847" },
  BANCO: { icon: "account-balance", iconBg: "#EDF2F8", iconFg: "#133A63", fieldLabel: "Número de tarjeta o préstamo", fieldPlaceholder: "Ej. 4417 8820 1134 2201" },
  SEGURO: { icon: "health-and-safety", iconBg: "#EAF9F1", iconFg: "#21A26B", fieldLabel: "Número de póliza", fieldPlaceholder: "Ej. POL-0234567" },
  EDUCACION: { icon: "school", iconBg: "#F3E8FF", iconFg: "#7C3AED", fieldLabel: "Código de alumno", fieldPlaceholder: "Ej. 20261234" },
  MUNICIPALIDAD: { icon: "location-city", iconBg: "#FCEEF3", iconFg: "#C2356B", fieldLabel: "Código de contribuyente", fieldPlaceholder: "Ej. 0341122" },
};

const BILLERS: SeedBiller[] = [
  // Luz
  { key: "luz-del-sur", name: "Luz del Sur", category: "LUZ" },
  { key: "enel", name: "Enel Distribución Perú", category: "LUZ" },
  { key: "electro-dunas", name: "Electro Dunas", category: "LUZ" },
  { key: "hidrandina", name: "Hidrandina", category: "LUZ" },
  { key: "electronorte", name: "Electronorte", category: "LUZ" },
  { key: "electrocentro", name: "Electrocentro", category: "LUZ" },
  { key: "seal", name: "SEAL", category: "LUZ" },

  // Agua
  { key: "sedapal", name: "Sedapal", category: "AGUA" },
  { key: "sedalib", name: "Sedalib", category: "AGUA" },
  { key: "seda-chimbote", name: "Seda Chimbote", category: "AGUA" },
  { key: "sedapar", name: "Sedapar", category: "AGUA" },
  { key: "emapa-canete", name: "Emapa Cañete", category: "AGUA" },
  { key: "epsel", name: "Epsel", category: "AGUA" },

  // Gas
  { key: "calidda", name: "Cálidda", category: "GAS" },
  { key: "solgas", name: "Solgas", category: "GAS" },
  { key: "zeta-gas", name: "Zeta Gas", category: "GAS" },
  { key: "llama-gas", name: "Llama Gas", category: "GAS" },
  { key: "repsol-gas", name: "Repsol Gas", category: "GAS" },

  // Móvil
  { key: "claro-movil", name: "Claro", category: "MOVIL" },
  { key: "movistar-movil", name: "Movistar", category: "MOVIL" },
  { key: "entel-movil", name: "Entel", category: "MOVIL" },
  { key: "bitel-movil", name: "Bitel", category: "MOVIL" },
  { key: "cuy-movil", name: "Cuy Móvil", category: "MOVIL" },
  { key: "flash-mobile", name: "Flash Mobile", category: "MOVIL" },
  { key: "imovil", name: "i Móvil", category: "MOVIL" },
  { key: "yo-movil", name: "Yo Móvil", category: "MOVIL" },

  // Cable / internet / TV
  { key: "claro-tv", name: "Claro TV", category: "CABLE" },
  { key: "movistar-tv", name: "Movistar TV", category: "CABLE" },
  { key: "directv", name: "DIRECTV", category: "CABLE" },
  { key: "win-internet", name: "Win Internet", category: "CABLE" },
  { key: "claro-hogar", name: "Claro Hogar", category: "CABLE" },
  { key: "movistar-hogar", name: "Movistar Hogar", category: "CABLE" },

  // Bancos (tarjetas / préstamos de otros bancos)
  { key: "bcp", name: "BCP", category: "BANCO" },
  { key: "bbva", name: "BBVA", category: "BANCO" },
  { key: "interbank", name: "Interbank", category: "BANCO" },
  { key: "scotiabank", name: "Scotiabank", category: "BANCO" },
  { key: "banco-nacion", name: "Banco de la Nación", category: "BANCO" },
  { key: "banco-pichincha", name: "Banco Pichincha", category: "BANCO" },
  { key: "banco-falabella", name: "Banco Falabella", category: "BANCO" },
  { key: "banco-ripley", name: "Banco Ripley", category: "BANCO" },
  { key: "mibanco", name: "Mibanco", category: "BANCO" },
  { key: "banco-gnb", name: "Banco GNB", category: "BANCO" },

  // Seguros
  { key: "rimac", name: "Rímac Seguros", category: "SEGURO" },
  { key: "pacifico", name: "Pacífico Seguros", category: "SEGURO" },
  { key: "la-positiva", name: "La Positiva", category: "SEGURO" },
  { key: "mapfre", name: "MAPFRE", category: "SEGURO" },
  { key: "interseguro", name: "Interseguro", category: "SEGURO" },

  // Educación
  { key: "pucp", name: "PUCP", category: "EDUCACION" },
  { key: "upc", name: "UPC", category: "EDUCACION" },
  { key: "usil", name: "USIL", category: "EDUCACION" },
  { key: "cibertec", name: "Cibertec", category: "EDUCACION" },
  { key: "senati", name: "SENATI", category: "EDUCACION" },

  // Municipalidades
  { key: "muni-lima", name: "Municipalidad de Lima", category: "MUNICIPALIDAD" },
  { key: "muni-miraflores", name: "Municipalidad de Miraflores", category: "MUNICIPALIDAD" },
  { key: "muni-san-isidro", name: "Municipalidad de San Isidro", category: "MUNICIPALIDAD" },
  { key: "muni-surco", name: "Municipalidad de Santiago de Surco", category: "MUNICIPALIDAD" },
  { key: "muni-san-borja", name: "Municipalidad de San Borja", category: "MUNICIPALIDAD" },
];

async function main() {
  for (const b of BILLERS) {
    const meta = CATEGORY_META[b.category];
    await prisma.biller.upsert({
      where: { key: b.key },
      update: { name: b.name, category: b.category, ...meta },
      create: { key: b.key, name: b.name, category: b.category, ...meta },
    });
  }
  console.log(`Seeded ${BILLERS.length} billers.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
