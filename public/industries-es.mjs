// Nombres en español de las industrias de Damodaran. El nombre original (inglés) se conserva como clave y se muestra
// junto a la traducción para que cualquiera pueda localizar la fila en su tabla.
export const INDUSTRY_ES={
 'Advertising':'Publicidad','Aerospace/Defense':'Aeroespacial y defensa','Air Transport':'Transporte aéreo','Apparel':'Confección y moda',
 'Auto & Truck':'Automóviles y camiones','Auto Parts':'Componentes de automoción','Bank (Money Center)':'Banca (grandes bancos)','Banks (Regional)':'Banca regional',
 'Beverage (Alcoholic)':'Bebidas alcohólicas','Beverage (Soft)':'Bebidas no alcohólicas','Broadcasting':'Radio y televisión','Brokerage & Investment Banking':'Intermediación y banca de inversión',
 'Building Materials':'Materiales de construcción','Business & Consumer Services':'Servicios a empresas y consumidores','Cable TV':'Televisión por cable','Chemical (Basic)':'Química básica',
 'Chemical (Diversified)':'Química diversificada','Chemical (Specialty)':'Química de especialidades','Coal & Related Energy':'Carbón y energía relacionada','Computer Services':'Servicios informáticos',
 'Computers/Peripherals':'Ordenadores y periféricos','Construction Supplies':'Suministros de construcción','Diversified':'Diversificadas','Drugs (Biotechnology)':'Biotecnología',
 'Drugs (Pharmaceutical)':'Farmacéuticas','Education':'Educación','Electrical Equipment':'Equipos eléctricos','Electronics (Consumer & Office)':'Electrónica de consumo y oficina',
 'Electronics (General)':'Electrónica general','Engineering/Construction':'Ingeniería y construcción','Entertainment':'Entretenimiento','Environmental & Waste Services':'Medio ambiente y residuos',
 'Farming/Agriculture':'Agricultura','Financial Svcs. (Non-bank & Insurance)':'Servicios financieros (no banca ni seguros)','Food Processing':'Alimentación (fabricación)','Food Wholesalers':'Distribución mayorista de alimentos',
 'Furn/Home Furnishings':'Muebles y hogar','Green & Renewable Energy':'Energías renovables','Healthcare Products':'Productos sanitarios','Healthcare Support Services':'Servicios de apoyo sanitario',
 'Heathcare Information and Technology':'Tecnología e información sanitaria','Homebuilding':'Promoción de viviendas','Hospitals/Healthcare Facilities':'Hospitales y centros sanitarios','Hotel/Gaming':'Hoteles y juego',
 'Household Products':'Productos del hogar y cosmética','Information Services':'Servicios de información','Insurance (General)':'Seguros generales','Insurance (Life)':'Seguros de vida',
 'Insurance (Prop/Cas.)':'Seguros de daños','Investments & Asset Management':'Inversión y gestión de activos','Machinery':'Maquinaria','Metals & Mining':'Metales y minería',
 'Office Equipment & Services':'Equipos y servicios de oficina','Oil/Gas (Integrated)':'Petróleo y gas (integradas)','Oil/Gas (Production and Exploration)':'Petróleo y gas (exploración y producción)','Oil/Gas Distribution':'Distribución de petróleo y gas',
 'Oilfield Svcs/Equip.':'Servicios y equipos petrolíferos','Packaging & Container':'Envases y embalajes','Paper/Forest Products':'Papel y productos forestales','Power':'Electricidad',
 'Precious Metals':'Metales preciosos','Publishing & Newspapers':'Editoriales y prensa','R.E.I.T.':'Socimis (REIT)','Real Estate (Development)':'Inmobiliario (promoción)',
 'Real Estate (General/Diversified)':'Inmobiliario (diversificado)','Real Estate (Operations & Services)':'Inmobiliario (gestión y servicios)','Recreation':'Ocio','Reinsurance':'Reaseguros',
 'Restaurant/Dining':'Restauración','Retail (Automotive)':'Comercio (automoción)','Retail (Building Supply)':'Comercio (bricolaje y construcción)','Retail (Distributors)':'Comercio (distribuidores)',
 'Retail (General)':'Comercio minorista general','Retail (Grocery and Food)':'Supermercados y alimentación','Retail (REITs)':'Socimis comerciales (REIT)','Retail (Special Lines)':'Comercio especializado',
 'Rubber& Tires':'Caucho y neumáticos','Semiconductor':'Semiconductores','Semiconductor Equip':'Equipos para semiconductores','Shipbuilding & Marine':'Construcción naval y transporte marítimo',
 'Shoe':'Calzado','Software (Entertainment)':'Software (entretenimiento)','Software (Internet)':'Software (internet)','Software (System & Application)':'Software (sistemas y aplicaciones)',
 'Steel':'Acero','Telecom (Wireless)':'Telecomunicaciones móviles','Telecom. Equipment':'Equipos de telecomunicaciones','Telecom. Services':'Servicios de telecomunicaciones',
 'Tobacco':'Tabaco','Transportation':'Transporte','Transportation (Railroads)':'Ferrocarriles','Trucking':'Transporte por carretera',
 'Utility (General)':'Servicios públicos (general)','Utility (Water)':'Agua','Total Market':'Mercado total','Total Market (without financials)':'Mercado total (sin financieras)','Grand Total':'Mercado total',
};
export const industryEs=name=>INDUSTRY_ES[name]||name;
