import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as invoiceService from '../services/invoice.service.js';
import { buildInvoicePdfBuffer } from '../services/pdf.service.js';

export const listClients = asyncHandler(async (req, res) => {
  const clients = await invoiceService.listClients({ workspaceId: req.workspace._id });
  return sendSuccess(res, { data: clients });
});

export const createClient = asyncHandler(async (req, res) => {
  const client = await invoiceService.createClient({
    workspaceId: req.workspace._id,
    payload: req.body,
  });
  return sendSuccess(res, { statusCode: 201, message: 'Client created', data: client });
});

export const updateClient = asyncHandler(async (req, res) => {
  const client = await invoiceService.updateClient({
    workspaceId: req.workspace._id,
    clientId: req.params.id,
    payload: req.body,
  });
  return sendSuccess(res, { message: 'Client updated', data: client });
});

export const deleteClient = asyncHandler(async (req, res) => {
  const data = await invoiceService.deleteClient({
    workspaceId: req.workspace._id,
    clientId: req.params.id,
  });
  return sendSuccess(res, { message: 'Client deleted', data });
});

export const listInvoices = asyncHandler(async (req, res) => {
  const invoices = await invoiceService.listInvoices({
    workspaceId: req.workspace._id,
    query: req.query,
  });
  return sendSuccess(res, { data: invoices });
});

export const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getInvoiceById({
    workspaceId: req.workspace._id,
    invoiceId: req.params.id,
  });
  return sendSuccess(res, { data: invoice });
});

export const createInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.createInvoice({
    workspace: req.workspace,
    actorId: req.user._id,
    payload: req.body,
  });
  return sendSuccess(res, { statusCode: 201, message: 'Invoice created', data: invoice });
});

export const updateInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.updateInvoice({
    workspace: req.workspace,
    invoiceId: req.params.id,
    payload: req.body,
  });
  return sendSuccess(res, { message: 'Invoice updated', data: invoice });
});

export const sendInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.sendInvoice({
    workspace: req.workspace,
    actorId: req.user._id,
    invoiceId: req.params.id,
  });
  return sendSuccess(res, { message: 'Invoice sent', data: invoice });
});

export const voidInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.voidInvoice({
    workspace: req.workspace,
    actorId: req.user._id,
    invoiceId: req.params.id,
  });
  return sendSuccess(res, { message: 'Invoice voided', data: invoice });
});

export const recordPayment = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.recordInvoicePayment({
    workspace: req.workspace,
    actorId: req.user._id,
    invoiceId: req.params.id,
    payload: req.body,
  });
  return sendSuccess(res, { statusCode: 201, message: 'Payment recorded', data: invoice });
});

export const downloadInvoicePdf = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getInvoiceById({
    workspaceId: req.workspace._id,
    invoiceId: req.params.id,
  });

  const pdfBuffer = await buildInvoicePdfBuffer({
    workspace: req.workspace,
    invoice,
    client: invoice.client,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${invoice.invoiceNumber}.pdf"`
  );
  res.setHeader('Content-Length', pdfBuffer.length);
  return res.status(200).send(pdfBuffer);
});
