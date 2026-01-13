import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { createBrandWorkflow } from "../workflows/create-brand";
import { createBrandCategoryWorkflow } from "../workflows/create-brand-category";
import { BRAND_MODULE } from "../modules/brand";
import * as fs from "fs";
import * as path from "path";
import Papa from "papaparse";

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => {
      return {
        selector: { id: data.input.store_id },
        update: {
          supported_currencies: data.input.supported_currencies.map(
            (currency) => {
              return {
                currency_code: currency.currency_code,
                is_default: currency.is_default ?? false,
              };
            }
          ),
        },
      };
    });

    const stores = updateStoresStep(normalizedInput);

    return new WorkflowResponse(stores);
  }
);

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  const countries = ["gb", "de", "dk", "se", "fr", "es", "it"];

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_locales: [
          {
            locale_code: "fr-FR"
          },
          {
            locale_code: "es-ES"
          }
        ]
      },
    },
  });
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    // create the default sales channel
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        {
          currency_code: "eur",
          is_default: true,
        },
        {
          currency_code: "usd",
        },
      ],
    },
  });

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });
  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Europe",
          currency_code: "eur",
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "European Warehouse",
          address: {
            city: "Copenhagen",
            country_code: "DK",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: "Default Shipping Profile",
              type: "default",
            },
          ],
        },
      });
    shippingProfile = shippingProfileResult[0];
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "European Warehouse delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Europe",
        geo_zones: [
          {
            country_code: "gb",
            type: "country",
          },
          {
            country_code: "de",
            type: "country",
          },
          {
            country_code: "dk",
            type: "country",
          },
          {
            country_code: "se",
            type: "country",
          },
          {
            country_code: "fr",
            type: "country",
          },
          {
            country_code: "es",
            type: "country",
          },
          {
            country_code: "it",
            type: "country",
          },
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            currency_code: "eur",
            amount: 10,
          },
          {
            region_id: region.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 24 hours.",
          code: "express",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            currency_code: "eur",
            amount: 10,
          },
          {
            region_id: region.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  const { result: publishableApiKeyResult } = await createApiKeysWorkflow(
    container
  ).run({
    input: {
      api_keys: [
        {
          title: "Webshop",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });
  const publishableApiKey = publishableApiKeyResult[0];

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");

  logger.info("Seeding product data...");

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Shirts",
          is_active: true,
        },
        {
          name: "Sweatshirts",
          is_active: true,
        },
        {
          name: "Pants",
          is_active: true,
        },
        {
          name: "Merch",
          is_active: true,
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Medusa T-Shirt",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Shirts")!.id,
          ],
          description:
            "Reimagine the feeling of a classic T-shirt. With our cotton T-shirts, everyday essentials no longer have to be ordinary.",
          handle: "t-shirt",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-back.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-white-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-white-back.png",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["S", "M", "L", "XL"],
            },
            {
              title: "Color",
              values: ["Black", "White"],
            },
          ],
          variants: [
            {
              title: "S / Black",
              sku: "SHIRT-S-BLACK",
              options: {
                Size: "S",
                Color: "Black",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "S / White",
              sku: "SHIRT-S-WHITE",
              options: {
                Size: "S",
                Color: "White",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "M / Black",
              sku: "SHIRT-M-BLACK",
              options: {
                Size: "M",
                Color: "Black",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "M / White",
              sku: "SHIRT-M-WHITE",
              options: {
                Size: "M",
                Color: "White",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "L / Black",
              sku: "SHIRT-L-BLACK",
              options: {
                Size: "L",
                Color: "Black",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "L / White",
              sku: "SHIRT-L-WHITE",
              options: {
                Size: "L",
                Color: "White",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "XL / Black",
              sku: "SHIRT-XL-BLACK",
              options: {
                Size: "XL",
                Color: "Black",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "XL / White",
              sku: "SHIRT-XL-WHITE",
              options: {
                Size: "XL",
                Color: "White",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Medusa Sweatshirt",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Sweatshirts")!.id,
          ],
          description:
            "Reimagine the feeling of a classic sweatshirt. With our cotton sweatshirt, everyday essentials no longer have to be ordinary.",
          handle: "sweatshirt",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-back.png",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["S", "M", "L", "XL"],
            },
          ],
          variants: [
            {
              title: "S",
              sku: "SWEATSHIRT-S",
              options: {
                Size: "S",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "M",
              sku: "SWEATSHIRT-M",
              options: {
                Size: "M",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "L",
              sku: "SWEATSHIRT-L",
              options: {
                Size: "L",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "XL",
              sku: "SWEATSHIRT-XL",
              options: {
                Size: "XL",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Medusa Sweatpants",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Pants")!.id,
          ],
          description:
            "Reimagine the feeling of classic sweatpants. With our cotton sweatpants, everyday essentials no longer have to be ordinary.",
          handle: "sweatpants",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-back.png",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["S", "M", "L", "XL"],
            },
          ],
          variants: [
            {
              title: "S",
              sku: "SWEATPANTS-S",
              options: {
                Size: "S",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "M",
              sku: "SWEATPANTS-M",
              options: {
                Size: "M",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "L",
              sku: "SWEATPANTS-L",
              options: {
                Size: "L",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "XL",
              sku: "SWEATPANTS-XL",
              options: {
                Size: "XL",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Medusa Shorts",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Merch")!.id,
          ],
          description:
            "Reimagine the feeling of classic shorts. With our cotton shorts, everyday essentials no longer have to be ordinary.",
          handle: "shorts",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/shorts-vintage-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/shorts-vintage-back.png",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["S", "M", "L", "XL"],
            },
          ],
          variants: [
            {
              title: "S",
              sku: "SHORTS-S",
              options: {
                Size: "S",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "M",
              sku: "SHORTS-M",
              options: {
                Size: "M",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "L",
              sku: "SHORTS-L",
              options: {
                Size: "L",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "XL",
              sku: "SHORTS-XL",
              options: {
                Size: "XL",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });
  logger.info("Finished seeding product data.");

  logger.info("Seeding inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const inventoryLevels: CreateInventoryLevelInput[] = [];
  for (const inventoryItem of inventoryItems) {
    const inventoryLevel = {
      location_id: stockLocation.id,
      stocked_quantity: 1000000,
      inventory_item_id: inventoryItem.id,
    };
    inventoryLevels.push(inventoryLevel);
  }

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryLevels,
    },
  });

  logger.info("Finished seeding inventory levels data.");

  // CSV dosyalarından veri yükleme ve seed işlemleri
  await seedFromCsvFiles(container, logger, query, shippingProfile, defaultSalesChannel, stockLocation);
}

/**
 * CSV dosyalarından veri yükleme ve seed işlemleri
 */
async function seedFromCsvFiles(
  container: any,
  logger: any,
  query: any,
  shippingProfile: any,
  defaultSalesChannel: any[],
  stockLocation: any
) {
  logger.info("Loading data from CSV files...");
  
  const csvDataPath = path.join(process.cwd(), "src", "scripts", "tipbox-datas");
  
  // CSV dosyalarını yükle
  const { categoriesData, brandsData, productsData } = loadCsvData(csvDataPath, logger);
  
  logger.info(`Loaded ${categoriesData.length} categories, ${brandsData.length} brands, ${productsData.length} products`);

  // 1. Önce brand'leri oluştur
  const brandMap = await seedBrands(container, logger, brandsData);
  
  // 2. Sonra category'leri oluştur (parent-child ilişkisi ile)
  const categoryMap = await seedCategories(container, logger, categoriesData);
  
  // 3. Product'leri oluştur
  const productMap = await seedProducts(
    container,
    logger,
    productsData,
    categoryMap,
    shippingProfile,
    defaultSalesChannel
  );
  
  // 4. Product-Brand linkleme
  await linkProductsToBrands(container, logger, productsData, productMap, brandMap);
  
  // 5. Inventory levels oluştur
  await createInventoryLevelsForProducts(container, logger, query, stockLocation);
}

/**
 * CSV dosyalarını yükle
 */
function loadCsvData(csvDataPath: string, logger: any) {
  // Categories CSV'yi oku
  logger.info("Reading categories CSV...");
  const categoriesCsvPath = path.join(csvDataPath, "categories.csv");
  const categoriesCsvContent = fs.readFileSync(categoriesCsvPath, "utf-8");
  const categoriesData = Papa.parse(categoriesCsvContent, {
    header: true,
    skipEmptyLines: true,
  }).data as any[];

  // Brands CSV'yi oku
  logger.info("Reading brands CSV...");
  const brandsCsvPath = path.join(csvDataPath, "brands.csv");
  const brandsCsvContent = fs.readFileSync(brandsCsvPath, "utf-8");
  const brandsData = Papa.parse(brandsCsvContent, {
    header: true,
    skipEmptyLines: true,
  }).data as any[];

  // Products CSV'yi oku
  logger.info("Reading products CSV...");
  const productsCsvPath = path.join(csvDataPath, "products_with_images.csv");
  const productsCsvContent = fs.readFileSync(productsCsvPath, "utf-8");
  const productsData = Papa.parse(productsCsvContent, {
    header: true,
    skipEmptyLines: true,
  }).data as any[];

  return { categoriesData, brandsData, productsData };
}

/**
 * Brand'leri oluştur
 */
async function seedBrands(container: any, logger: any, brandsData: any[]): Promise<Map<string, string>> {
  logger.info("Creating brands from CSV...");
  const brandMap = new Map<string, string>(); // CSV id -> Medusa id mapping
  const brandModuleService = container.resolve(BRAND_MODULE);

  for (const brandRow of brandsData) {
    if (brandRow.deleted_at) continue;
    
    try {
      const { result: brandResult } = await createBrandWorkflow(container).run({
        input: {
          name: brandRow.name,
          category_id: null,
        },
      });

      if (brandResult) {
        brandMap.set(brandRow.id, brandResult.id);
        
        // Logo URL varsa güncelle
        if (brandRow.logo_url) {
          try {
            await brandModuleService.updateBrands({
              selector: { id: brandResult.id },
              data: {
                logo_url: brandRow.logo_url,
              },
            });
          } catch (error: any) {
            logger.warn(`Failed to update brand logo for ${brandRow.name}: ${error.message}`);
          }
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to create brand ${brandRow.name}: ${error.message}`);
    }
  }

  logger.info(`Created ${brandMap.size} brands`);
  return brandMap;
}

/**
 * Category'leri parent-child ilişkisi ile oluştur
 * Parent'lar önce oluşturulmalı
 */
async function seedCategories(container: any, logger: any, categoriesData: any[]): Promise<Map<string, string>> {
  logger.info("Creating product categories from CSV...");
  const categoryMap = new Map<string, string>(); // CSV id -> Medusa id mapping
  
  // Parent-child ilişkisine göre sırala
  const sortedCategories = sortCategoriesByParentChild(categoriesData);
  
  let createdCount = 0;
  let retryCount = 0;
  const maxRetries = 3;

  while (createdCount < sortedCategories.length && retryCount < maxRetries) {
    const remainingCategories = sortedCategories.filter(cat => !categoryMap.has(cat.id));
    
    if (remainingCategories.length === 0) break;

    let progressInThisRound = 0;

    for (const catRow of remainingCategories) {
      if (catRow.deleted_at || catRow.is_active === "False") {
        // Silinmiş veya aktif olmayan kategorileri map'e ekle (null olarak)
        categoryMap.set(catRow.id, "");
        createdCount++;
        continue;
      }
      
      try {
        // Parent kontrolü
        const parentCategoryId = catRow.parent_category_id && 
          catRow.parent_category_id !== "NULL" && 
          catRow.parent_category_id !== "" 
          ? categoryMap.get(catRow.parent_category_id) 
          : undefined;

        // Parent yoksa ve parent_id varsa, bu turda atla
        if (catRow.parent_category_id && 
            catRow.parent_category_id !== "NULL" && 
            catRow.parent_category_id !== "" &&
            !parentCategoryId) {
          continue; // Parent henüz oluşturulmamış, sonraki tura bırak
        }

        const { result: categoryResult } = await createProductCategoriesWorkflow(container).run({
          input: {
            product_categories: [{
              name: catRow.name,
              description: catRow.description || "",
              handle: catRow.handle,
              is_active: catRow.is_active === "True" || catRow.is_active === true,
              is_internal: catRow.is_internal === "True" || catRow.is_internal === true,
              rank: parseInt(catRow.rank) || 0,
              parent_category_id: parentCategoryId || undefined,
            }],
          },
        });

        if (categoryResult && categoryResult.length > 0) {
          categoryMap.set(catRow.id, categoryResult[0].id);
          createdCount++;
          progressInThisRound++;
        }
      } catch (error: any) {
        logger.warn(`Failed to create category ${catRow.name} (parent: ${catRow.parent_category_id}): ${error.message}`);
      }
    }

    if (progressInThisRound === 0) {
      retryCount++;
      logger.warn(`No progress in category creation. Retry ${retryCount}/${maxRetries}`);
    } else {
      retryCount = 0; // Progress var, retry sayacını sıfırla
      logger.info(`Created ${createdCount}/${sortedCategories.length} categories...`);
    }
  }

  if (createdCount < sortedCategories.length) {
    logger.warn(`Warning: Only created ${createdCount} out of ${sortedCategories.length} categories`);
  }

  logger.info(`Created ${categoryMap.size} product categories`);
  return categoryMap;
}

/**
 * Category'leri parent-child ilişkisine göre sırala
 * Parent'lar önce gelmeli
 */
function sortCategoriesByParentChild(categoriesData: any[]): any[] {
  const categoryMap = new Map<string, any>();
  const rootCategories: any[] = [];
  const childCategories: any[] = [];

  // Tüm kategorileri map'e ekle
  for (const cat of categoriesData) {
    categoryMap.set(cat.id, cat);
  }

  // Root ve child kategorileri ayır
  for (const cat of categoriesData) {
    const hasParent = cat.parent_category_id && 
      cat.parent_category_id !== "NULL" && 
      cat.parent_category_id !== "" &&
      categoryMap.has(cat.parent_category_id);
    
    if (hasParent) {
      childCategories.push(cat);
    } else {
      rootCategories.push(cat);
    }
  }

  // Root kategorileri önce ekle
  const sorted: any[] = [...rootCategories];

  // Child kategorileri level'a göre sırala (mpath kullanarak)
  const sortedChildren = [...childCategories].sort((a, b) => {
    const aLevel = a.mpath ? a.mpath.split(".").length : 0;
    const bLevel = b.mpath ? b.mpath.split(".").length : 0;
    return aLevel - bLevel;
  });

  sorted.push(...sortedChildren);

  return sorted;
}

/**
 * Product'leri oluştur
 */
async function seedProducts(
  container: any,
  logger: any,
  productsData: any[],
  categoryMap: Map<string, string>,
  shippingProfile: any,
  defaultSalesChannel: any[]
): Promise<Map<string, string>> {
  logger.info("Creating products from CSV...");
  const productMap = new Map<string, string>(); // CSV id -> Medusa id mapping
  const handleSet = new Set<string>(); // Unique handle kontrolü için
  let createdProducts = 0;
  const batchSize = 50; // Batch halinde oluştur

  for (let i = 0; i < productsData.length; i += batchSize) {
    const batch = productsData.slice(i, i + batchSize);
    const productsToCreate: any[] = [];
    const batchProductIds: string[] = []; // Batch'teki product_id'leri takip et

    for (const productRow of batch) {
      try {
        // Category IDs'i parse et (yeni format: JSON array string)
        let categoryIds: string[] = [];
        if (productRow.category_ids) {
          try {
            const parsed = JSON.parse(productRow.category_ids);
            if (Array.isArray(parsed)) {
              categoryIds = parsed
                .map((catId: string) => categoryMap.get(catId))
                .filter((id: string | undefined) => id !== undefined && id !== "") as string[];
            }
          } catch (e) {
            // JSON parse hatası, devam et
          }
        }

        // Images'i parse et (yeni format: JSON array string)
        let images: { url: string }[] = [];
        if (productRow.thumbnail) {
          images.push({ url: productRow.thumbnail });
        }
        if (productRow.images) {
          try {
            const parsed = JSON.parse(productRow.images);
            if (Array.isArray(parsed)) {
              parsed.forEach((imgUrl: string) => {
                if (imgUrl && !images.some(i => i.url === imgUrl)) {
                  images.push({ url: imgUrl });
                }
              });
            }
          } catch (e) {
            // JSON parse hatası, devam et
          }
        }

        // Handle oluştur (title'den)
        let baseHandle = (productRow.title || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .substring(0, 90);
        
        if (!baseHandle) {
          baseHandle = `product-${productRow.id}`;
        }
        
        let handle = baseHandle;
        let counter = 1;
        while (handleSet.has(handle)) {
          handle = `${baseHandle}-${counter}`;
          counter++;
        }
        handleSet.add(handle);

        // Metadata parse et
        let metadata = null;
        if (productRow.metadata) {
          try {
            metadata = JSON.parse(productRow.metadata);
          } catch (e) {
            // JSON parse hatası, null bırak
          }
        }

        productsToCreate.push({
          title: (productRow.title || "").substring(0, 255),
          description: productRow.description || "",
          handle: handle,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          category_ids: categoryIds,
          images: images,
          metadata: metadata,
          variants: [
            {
              title: "Default",
              sku: `SKU-${productRow.id}`,
              prices: [
                {
                  amount: 1000, // Default price
                  currency_code: "eur",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        });
        
        batchProductIds.push(productRow.id);
      } catch (error: any) {
        logger.warn(`Failed to prepare product ${productRow.title || productRow.id}: ${error.message}`);
      }
    }

    if (productsToCreate.length > 0) {
      try {
        const { result: createdProductsResult } = await createProductsWorkflow(container).run({
          input: {
            products: productsToCreate,
          },
        });

        // Product mapping oluştur - sıralı eşleştirme
        for (let j = 0; j < batchProductIds.length && j < createdProductsResult.length; j++) {
          const csvProductId = batchProductIds[j];
          const createdProduct = createdProductsResult[j];
          if (createdProduct && csvProductId) {
            productMap.set(csvProductId, createdProduct.id);
          }
        }

        createdProducts += createdProductsResult.length;
        logger.info(`Created ${createdProducts}/${productsData.length} products...`);
      } catch (error: any) {
        logger.warn(`Failed to create products batch: ${error.message}`);
      }
    }
  }

  logger.info(`Created ${createdProducts} products`);
  return productMap;
}

/**
 * Product-Brand linkleme
 */
async function linkProductsToBrands(
  container: any,
  logger: any,
  productsData: any[],
  productMap: Map<string, string>,
  brandMap: Map<string, string>
) {
  logger.info("Linking products to brands from CSV...");
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK);
  let linkedCount = 0;
  let skippedCount = 0;

  for (const productRow of productsData) {
    if (!productRow.brand_id || productRow.brand_id === "NULL" || productRow.brand_id === "") {
      skippedCount++;
      continue;
    }

    const productId = productMap.get(productRow.id);
    const brandId = brandMap.get(productRow.brand_id);

    if (!productId || !brandId) {
      skippedCount++;
      continue;
    }

    try {
      await remoteLink.create({
        [Modules.PRODUCT]: {
          product_id: productId,
        },
        brand: {
          brand_id: brandId,
        },
      });
      linkedCount++;
    } catch (error: any) {
      logger.warn(`Failed to link product ${productRow.id} to brand ${productRow.brand_id}: ${error.message}`);
    }
  }

  logger.info(`Linked ${linkedCount} products to brands (skipped: ${skippedCount})`);
}

/**
 * Yeni ürünler için inventory levels oluştur
 */
async function createInventoryLevelsForProducts(
  container: any,
  logger: any,
  query: any,
  stockLocation: any
) {
  logger.info("Creating inventory levels for new products...");
  
  // Tüm inventory items'ları al
  const { data: allInventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  // Mevcut inventory levels'ları kontrol et
  const inventoryModuleService = container.resolve(Modules.INVENTORY);
  const existingLevels = await inventoryModuleService.listInventoryLevels({
    location_id: stockLocation.id,
  });
  const existingItemIds = new Set(existingLevels.map((level: any) => level.inventory_item_id));

  // Yeni inventory levels oluştur
  const newInventoryLevels: CreateInventoryLevelInput[] = [];
  for (const inventoryItem of allInventoryItems) {
    if (!existingItemIds.has(inventoryItem.id)) {
      const inventoryLevel = {
        location_id: stockLocation.id,
        stocked_quantity: 1000000,
        inventory_item_id: inventoryItem.id,
      };
      newInventoryLevels.push(inventoryLevel);
    }
  }

  if (newInventoryLevels.length > 0) {
    await createInventoryLevelsWorkflow(container).run({
      input: {
        inventory_levels: newInventoryLevels,
      },
    });
    logger.info(`Created inventory levels for ${newInventoryLevels.length} items`);
  } else {
    logger.info("No new inventory levels needed");
  }
}
