// Stable UI-facing service interface. Pages import from this file and do not
// need to know whether data is coming from local demo storage or real APIs.
import * as mock from "./crmMockService";
import * as api from "./crmApiService";
import * as customerApi from "./customerApiService";
import * as orderApi from "./orderApiService";
import * as resourceApi from "./crmResourceApiService";
import * as reportingApi from "./crmReportingApiService";
import * as supportApi from "./crmSupportApiService";
import * as storefrontSupportApi from "./storefrontSupportApiService";
import * as storefrontOrderApi from "./storefrontOrderApiService";
import * as leadBannerApi from "./crmLeadBannerApiService";
import {
  getProductCatalog,
  createCatalogProduct,
  bulkCreateCatalogProducts,
  updateCatalogProduct,
  setCatalogProductStatus,
} from "./productCatalogService";
import * as operationsApi from "./crmOperationsApiService";
import * as orderOperationsApi from "./crmOrderOperationsApiService";
export const crmCommunicationsMode = operationsApi.crmCommunicationsMode;
export const storefrontOrdersMode = storefrontOrderApi.storefrontOrdersApiEnabled ? "api" : "demo";
export const storefrontSupportMode = storefrontSupportApi.storefrontSupportApiEnabled ? "api" : "demo";

const configuredMode = String(import.meta.env.VITE_CRM_DATA_MODE || "mock").trim().toLowerCase();
export const crmDataMode = configuredMode === "api" ? "api" : "mock";
const service = crmDataMode === "api" ? api : mock;
const configuredCustomerMode = String(import.meta.env.VITE_CRM_CUSTOMERS_MODE || "mock").trim().toLowerCase();
export const crmCustomersMode = configuredCustomerMode === "api" ? "api" : "mock";
const configuredOrdersMode = String(import.meta.env.VITE_CRM_ORDERS_MODE || "mock").trim().toLowerCase();
export const crmOrdersMode = configuredOrdersMode === "api" ? "api" : "mock";
const configuredSegmentsMode = String(import.meta.env.VITE_CRM_SEGMENTS_MODE || "mock").trim().toLowerCase();
export const crmSegmentsMode = configuredSegmentsMode === "api" ? "api" : "mock";
const configuredCampaignsMode = String(import.meta.env.VITE_CRM_CAMPAIGNS_MODE || "mock").trim().toLowerCase();
export const crmCampaignsMode = configuredCampaignsMode === "api" ? "api" : "mock";
const configuredInteractionsMode = String(import.meta.env.VITE_CRM_INTERACTIONS_MODE || "mock").trim().toLowerCase();
export const crmInteractionsMode = configuredInteractionsMode === "api" ? "api" : "mock";
const configuredAnalyticsMode = String(import.meta.env.VITE_CRM_ANALYTICS_MODE || "mock").trim().toLowerCase();
export const crmAnalyticsMode = configuredAnalyticsMode === "api" ? "api" : "mock";
const configuredCampaignResponsesMode = String(import.meta.env.VITE_CRM_CAMPAIGN_RESPONSES_MODE || "mock").trim().toLowerCase();
export const crmCampaignResponsesMode = configuredCampaignResponsesMode === "api" ? "api" : "mock";
const configuredAuditLogsMode = String(import.meta.env.VITE_CRM_AUDIT_LOGS_MODE || "mock").trim().toLowerCase();
export const crmAuditLogsMode = configuredAuditLogsMode === "api" ? "api" : "mock";
const configuredProductsMode = String(import.meta.env.VITE_CRM_PRODUCTS_MODE || "mock").trim().toLowerCase();
export const crmProductsMode = configuredProductsMode === "api" ? "api" : "mock";
const configuredCategoriesMode = String(import.meta.env.VITE_CRM_CATEGORIES_MODE || "mock").trim().toLowerCase();
export const crmCategoriesMode = configuredCategoriesMode === "api" ? "api" : "mock";
const configuredSupportMode = String(import.meta.env.VITE_CRM_SUPPORT_MODE || "mock").trim().toLowerCase();
export const crmSupportMode = configuredSupportMode === "api" ? "api" : "mock";
const configuredLeadsMode = String(import.meta.env.VITE_CRM_LEADS_MODE || "mock").trim().toLowerCase();
export const crmLeadsMode = configuredLeadsMode === "api" ? "api" : "mock";
const configuredBannersMode = String(import.meta.env.VITE_CRM_BANNERS_MODE || "mock").trim().toLowerCase();
export const crmBannersMode = configuredBannersMode === "api" ? "api" : "mock";
const configuredHomepagePromotionsMode = String(import.meta.env.VITE_CRM_HOMEPAGE_PROMOTIONS_MODE || "mock").trim().toLowerCase();
export const crmHomepagePromotionsMode = configuredHomepagePromotionsMode === "api" ? "api" : "mock";
const configuredInventoryMode = String(import.meta.env.VITE_CRM_INVENTORY_MODE || "mock").trim().toLowerCase();
export const crmInventoryMode = configuredInventoryMode === "api" ? "api" : "mock";
const configuredCouponsMode = String(import.meta.env.VITE_CRM_COUPONS_MODE || "mock").trim().toLowerCase();
export const crmCouponsMode = configuredCouponsMode === "api" ? "api" : "mock";
const configuredAbandonedCartsMode = String(import.meta.env.VITE_CRM_ABANDONED_CARTS_MODE || "mock").trim().toLowerCase();
export const crmAbandonedCartsMode = configuredAbandonedCartsMode === "api" ? "api" : "mock";
const configuredShipmentsMode = String(import.meta.env.VITE_CRM_SHIPMENTS_MODE || "mock").trim().toLowerCase();
export const crmShipmentsMode = configuredShipmentsMode === "api" ? "api" : "mock";
const configuredReturnsMode = String(import.meta.env.VITE_CRM_RETURNS_MODE || "mock").trim().toLowerCase();
export const crmReturnsMode = configuredReturnsMode === "api" ? "api" : "mock";
const configuredOrderActivityMode = String(import.meta.env.VITE_CRM_ORDER_ACTIVITY_MODE || "mock").trim().toLowerCase();
export const crmOrderActivityMode = configuredOrderActivityMode === "api" ? "api" : "mock";

// Customer Management can be enabled against Django independently of all other mock modules.
export const getCustomers = (...args) => crmCustomersMode === "api" ? customerApi.getCustomers(...args) : service.getCustomers(...args);
export const createCustomer = (...args) => crmCustomersMode === "api" ? customerApi.createCustomer(...args) : mock.createCustomer(...args);
export const updateCustomer = (...args) => crmCustomersMode === "api" ? customerApi.updateCustomer(...args) : mock.updateCustomer(...args);
export const getCustomerById = (...args) => crmCustomersMode === "api" ? customerApi.getCustomerById(...args) : service.getCustomerById(...args);
export const getCustomerOrders = (...args) => crmCustomersMode === "api" ? customerApi.getCustomerOrders(...args) : service.getCustomerOrders(...args);
// Orders can be switched to the real Django API independently. All other modules
// continue to use VITE_CRM_DATA_MODE, which remains mock during staged integration.
export const getOrderManagementOrders = (...args) => crmOrdersMode === "api" ? orderApi.getOrderManagementOrders(...args) : service.getOrderManagementOrders(...args);
export const getManagedOrderById = (...args) => crmOrdersMode === "api" ? orderApi.getManagedOrderById(...args) : service.getManagedOrderById(...args);
export const updateOrderFulfillmentStatus = (...args) => crmOrdersMode === "api" ? orderApi.updateOrderStatus(...args) : service.updateOrderFulfillmentStatus(...args);
export const updateOrderPaymentStatus = (...args) => crmOrdersMode === "api" ? orderApi.updateOrderPaymentStatus(...args) : service.updateOrderPaymentStatus(...args);
export const addOrderInternalNote = (...args) => crmOrdersMode === "api" ? orderApi.addOrderInternalNote(...args) : service.addOrderInternalNote(...args);
export const getSupportedOrderTransitions = (...args) => crmOrdersMode === "api" ? orderApi.getSupportedOrderTransitions(...args) : null;
export const getDashboardData = (...args) => service.getDashboardData(...args);
export const getInteractions = (...args) => crmInteractionsMode === "api" ? resourceApi.getApiInteractions(...args) : mock.getInteractions(...args);
export const createInteraction = (...args) => crmInteractionsMode === "api" ? resourceApi.createApiInteraction(...args) : mock.createInteraction(...args);
export const updateInteractionStatus = (...args) => crmInteractionsMode === "api" ? Promise.reject(new Error("The Django Interaction model has no status field; status changes are only available in demo mode.")) : mock.updateInteractionStatus(...args);
export const getSupportTickets = (...args) => crmSupportMode === "api" ? supportApi.getApiSupportTickets(...args) : service.getSupportTickets(...args);
export const getSupportTicketById = (...args) => crmSupportMode === "api" ? supportApi.getApiSupportTicketById(...args) : service.getSupportTicketById(...args);
export const getMySupportTickets = (emailOrRequest, authenticatedRequest) => storefrontSupportApi.storefrontSupportApiEnabled
  ? storefrontSupportApi.getMySupportTickets(authenticatedRequest || emailOrRequest)
  : service.getMySupportTickets(emailOrRequest);
export const getMySupportTicketById = (id, emailOrRequest, authenticatedRequest) => storefrontSupportApi.storefrontSupportApiEnabled
  ? storefrontSupportApi.getMySupportTicketById(id, authenticatedRequest || emailOrRequest)
  : service.getMySupportTicketById(id, emailOrRequest);
export const createMySupportTicket = (input, user, authenticatedRequest) => storefrontSupportApi.storefrontSupportApiEnabled
  ? storefrontSupportApi.createMySupportTicket(input, authenticatedRequest)
  : service.createMySupportTicket(input, user);
export const addMySupportTicketReply = (id, text, user, authenticatedRequest) => storefrontSupportApi.storefrontSupportApiEnabled
  ? storefrontSupportApi.addMySupportTicketReply(id, text, authenticatedRequest)
  : service.addMySupportTicketReply(id, text, user);
export const importLegacyMySupportTickets = (...args) => storefrontSupportApi.importLegacyMySupportTickets(...args);
export const getLocalMySupportTickets = (...args) => mock.getMySupportTickets(...args);
export const createStorefrontOrder = (...args) => storefrontOrderApi.createStorefrontOrder(...args);
export const getStorefrontOrders = (...args) => storefrontOrderApi.getStorefrontOrders(...args);
export const getStorefrontOrderById = (...args) => storefrontOrderApi.getStorefrontOrderById(...args);
export const importLegacyDemoOrders = (...args) => storefrontOrderApi.importLegacyDemoOrders(...args);
export const createSupportTicket = (...args) => crmSupportMode === "api" ? supportApi.createApiSupportTicket(...args) : service.createSupportTicket(...args);
export const updateSupportTicketStatus = (...args) => crmSupportMode === "api" ? supportApi.updateApiSupportTicketStatus(...args) : service.updateSupportTicketStatus(...args);
export const updateSupportTicketPriority = (...args) => crmSupportMode === "api" ? supportApi.updateApiSupportTicketPriority(...args) : service.updateSupportTicketPriority(...args);
export const assignSupportTicket = (...args) => crmSupportMode === "api" ? supportApi.assignApiSupportTicket(...args) : service.assignSupportTicket(...args);
export const addSupportTicketMessage = (...args) => crmSupportMode === "api" ? supportApi.addApiSupportTicketMessage(...args) : service.addSupportTicketMessage(...args);
export const getSegments = (...args) => crmSegmentsMode === "api" ? resourceApi.getApiSegments(...args) : mock.getSegments(...args);
export const createSegment = (...args) => crmSegmentsMode === "api" ? resourceApi.createApiSegment(...args) : mock.createSegment(...args);
export const getCampaigns = (...args) => crmCampaignsMode === "api" ? resourceApi.getApiCampaigns(...args) : mock.getCampaigns(...args);
export const createCampaign = (...args) => crmCampaignsMode === "api" ? resourceApi.createApiCampaign(...args) : mock.createCampaign(...args);
export const simulateCampaignLaunch = (...args) => crmCampaignsMode === "api" ? resourceApi.setApiCampaignRunning(...args) : mock.simulateCampaignLaunch(...args);
export const getAnalyticsData = (...args) => crmAnalyticsMode === "api" ? reportingApi.getApiAnalytics(...args) : service.getAnalyticsData(...args);
export const getCampaignResponses = (...args) =>
  crmCampaignResponsesMode === "api"
    ? reportingApi.getApiCampaignResponses(...args)
    : Promise.resolve([]);
export const getAuditLogs = (...args) => crmAuditLogsMode === "api"
  ? reportingApi.getApiAuditLogs(...args)
  : Promise.resolve([]);

export const getBanners = (...args) => crmBannersMode === "api" ? leadBannerApi.getApiBanners(...args) : service.getBanners(...args);
export const createBanner = (...args) => crmBannersMode === "api" ? leadBannerApi.createApiBanner(...args) : service.createBanner(...args);
export const updateBanner = (...args) => crmBannersMode === "api" ? leadBannerApi.updateApiBanner(...args) : service.updateBanner(...args);
export const setBannerStatus = (...args) => crmBannersMode === "api" ? leadBannerApi.setApiBannerStatus(...args) : service.setBannerStatus(...args);
export const getStorefrontBanners = (...args) => crmBannersMode === "api" ? leadBannerApi.getApiStorefrontBanners(...args) : service.getStorefrontBanners(...args);
export const recordBannerImpression = (...args) => crmBannersMode === "api" ? leadBannerApi.recordApiBannerMetric(args[0], "impression") : service.recordBannerImpression(...args);
export const recordBannerClick = (...args) => crmBannersMode === "api" ? leadBannerApi.recordApiBannerMetric(args[0], "click") : service.recordBannerClick(...args);

// Product catalogue supports the mock browser store now and proposed Django endpoints in API mode.
export const getProducts = (...args) => getProductCatalog(...args);
export const createProduct = (...args) => createCatalogProduct(...args);
export const bulkCreateProducts = (...args) =>
  bulkCreateCatalogProducts(...args);
export const updateProduct = (...args) => updateCatalogProduct(...args);
export const setProductStatus = (...args) =>
  setCatalogProductStatus(...args);


// Lead management uses the same UI-facing service abstraction as other CRM modules.
export const getLeads = (...args) => crmLeadsMode === "api" ? leadBannerApi.getApiLeads(...args) : service.getLeads(...args);
export const createLead = (...args) => crmLeadsMode === "api" ? leadBannerApi.createApiLead(...args) : service.createLead(...args);
export const updateLead = (...args) => crmLeadsMode === "api" ? leadBannerApi.updateApiLead(...args) : service.updateLead(...args);
export const updateLeadStatus = (...args) => crmLeadsMode === "api" ? leadBannerApi.updateApiLeadStatus(...args) : service.updateLeadStatus(...args);
export const assignLead = (...args) => crmLeadsMode === "api" ? leadBannerApi.assignApiLead(...args) : service.assignLead(...args);
export const addLeadFollowUp = (...args) => crmLeadsMode === "api" ? leadBannerApi.addApiLeadFollowUp(...args) : service.addLeadFollowUp(...args);
export const convertLead = (...args) => crmLeadsMode === "api" ? leadBannerApi.convertApiLead(...args) : service.convertLead(...args);


// Communications and notifications are independently switchable from the other CRM modules.
export const getCommunicationTemplates = (params = {}, authenticatedRequest) => crmCommunicationsMode === "api" ? operationsApi.getApiCommunicationTemplates(params, authenticatedRequest) : service.getCommunicationTemplates(params);
export const createCommunicationTemplate = (input = {}, authenticatedRequest) => crmCommunicationsMode === "api" ? operationsApi.createApiCommunicationTemplate(input, authenticatedRequest) : service.createCommunicationTemplate(input);
export const updateCommunicationTemplate = (id, input = {}, authenticatedRequest) => crmCommunicationsMode === "api" ? operationsApi.updateApiCommunicationTemplate(id, input, authenticatedRequest) : service.updateCommunicationTemplate(id, input);
export const deleteCommunicationTemplate = (id, authenticatedRequest) => crmCommunicationsMode === "api" ? operationsApi.deleteApiCommunicationTemplate(id, authenticatedRequest) : service.deleteCommunicationTemplate(id);
export const getCommunicationHistory = (params = {}, authenticatedRequest) => crmCommunicationsMode === "api" ? operationsApi.getApiCommunicationHistory(params, authenticatedRequest) : service.getCommunicationHistory(params);
export const dispatchCommunication = (input = {}, actor = "CRM Staff", authenticatedRequest) => crmCommunicationsMode === "api" ? operationsApi.dispatchApiCommunication(input, actor, authenticatedRequest) : service.dispatchCommunication(input, actor);
export const getNotificationsForUser = (user = {}, authenticatedRequest) => crmCommunicationsMode === "api" ? operationsApi.getApiNotificationsForUser(user, authenticatedRequest) : service.getNotificationsForUser(user);
export const markNotificationReadForUser = (id, user = {}, authenticatedRequest) => crmCommunicationsMode === "api" ? operationsApi.markApiNotificationRead(id, user, authenticatedRequest) : service.markNotificationReadForUser(id, user);
export const markAllNotificationsReadForUser = (user = {}, authenticatedRequest) => crmCommunicationsMode === "api" ? operationsApi.markApiAllNotificationsRead(user, authenticatedRequest) : service.markAllNotificationsReadForUser(user);


// Phase 27 order operations: separately switchable shipment, return and timeline APIs.
export const getOrderShipments = (...args) => crmShipmentsMode === "api" ? orderOperationsApi.getOrderShipments(...args) : Promise.resolve([]);
export const createOrderShipment = (...args) => crmShipmentsMode === "api" ? orderOperationsApi.createOrderShipment(...args) : Promise.reject(new Error("Shipment API mode is disabled."));
export const updateOrderShipment = (...args) => crmShipmentsMode === "api" ? orderOperationsApi.updateOrderShipment(...args) : Promise.reject(new Error("Shipment API mode is disabled."));
export const getOrderReturns = (...args) => crmReturnsMode === "api" ? orderOperationsApi.getOrderReturns(...args) : Promise.resolve([]);
export const createOrderReturn = (...args) => crmReturnsMode === "api" ? orderOperationsApi.createOrderReturn(...args) : Promise.reject(new Error("Returns API mode is disabled."));
export const updateOrderReturnStatus = (...args) => crmReturnsMode === "api" ? orderOperationsApi.updateOrderReturnStatus(...args) : Promise.reject(new Error("Returns API mode is disabled."));
export const getOrderActivity = (...args) => crmOrderActivityMode === "api" ? orderOperationsApi.getOrderActivity(...args) : Promise.resolve([]);
export const createOrderActivity = (...args) => crmOrderActivityMode === "api" ? orderOperationsApi.createOrderActivity(...args) : Promise.reject(new Error("Order activity API mode is disabled."));
