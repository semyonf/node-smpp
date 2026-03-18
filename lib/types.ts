import { PDU } from './pdu';

// ========== Base PDU Interface ==========

/**
 * Base PDU fields present on all PDUs
 */
export interface BasePDU {
  command: string;
  command_length: number;
  command_id: number;
  command_status: number;
  sequence_number: number;
  response(options?: Record<string, unknown>): PDU;
  isResponse(): boolean;
}

// ========== Helper Types ==========

/**
 * Short message content - can be raw buffer, decoded message object with optional UDH, or string.
 * When encoding (input), udh is a single Buffer containing the full UDH.
 * When decoding (output), udh is an array of Buffers (one per UDH information element).
 */
export type ShortMessage = Buffer | { message?: string; udh?: Buffer | Buffer[] } | string;

/**
 * Destination address for submit_multi
 */
export interface DestAddress {
  dest_flag: number;
  dest_addr_ton?: number;
  dest_addr_npi?: number;
  destination_addr?: string;
  dl_name?: string;
}

/**
 * Unsuccess SME info for submit_multi_resp
 */
export interface UnsuccessSme {
  dest_addr_ton: number;
  dest_addr_npi: number;
  destination_addr: string;
  error_status_code: number;
}

// ========== PDU Interfaces ==========

/**
 * alert_notification PDU
 */
export interface AlertNotificationPDU extends BasePDU {
  command: 'alert_notification';
  source_addr_ton: number;
  source_addr_npi: number;
  source_addr: string;
  esme_addr_ton: number;
  esme_addr_npi: number;
  esme_addr: string;
}

/**
 * bind_receiver PDU
 */
export interface BindReceiverPDU extends BasePDU {
  command: 'bind_receiver';
  system_id: string;
  password: string;
  system_type: string;
  interface_version: number;
  addr_ton: number;
  addr_npi: number;
  address_range: string;
}

/**
 * bind_receiver_resp PDU
 */
export interface BindReceiverRespPDU extends BasePDU {
  command: 'bind_receiver_resp';
  system_id: string;
}

/**
 * bind_transmitter PDU
 */
export interface BindTransmitterPDU extends BasePDU {
  command: 'bind_transmitter';
  system_id: string;
  password: string;
  system_type: string;
  interface_version: number;
  addr_ton: number;
  addr_npi: number;
  address_range: string;
}

/**
 * bind_transmitter_resp PDU
 */
export interface BindTransmitterRespPDU extends BasePDU {
  command: 'bind_transmitter_resp';
  system_id: string;
}

/**
 * bind_transceiver PDU
 */
export interface BindTransceiverPDU extends BasePDU {
  command: 'bind_transceiver';
  system_id: string;
  password: string;
  system_type: string;
  interface_version: number;
  addr_ton: number;
  addr_npi: number;
  address_range: string;
}

/**
 * bind_transceiver_resp PDU
 */
export interface BindTransceiverRespPDU extends BasePDU {
  command: 'bind_transceiver_resp';
  system_id: string;
}

/**
 * broadcast_sm PDU
 */
export interface BroadcastSmPDU extends BasePDU {
  command: 'broadcast_sm';
  service_type: string;
  source_addr_ton: number;
  source_addr_npi: number;
  source_addr: string;
  message_id: string;
  priority_flag: number;
  schedule_delivery_time: string | Date;
  validity_period: string | Date;
  replace_if_present_flag: number;
  data_coding: number | null;
  sm_default_msg_id: number;
}

/**
 * broadcast_sm_resp PDU
 */
export interface BroadcastSmRespPDU extends BasePDU {
  command: 'broadcast_sm_resp';
  message_id: string;
  failed_broadcast_area_identifier?: unknown;
}

/**
 * cancel_broadcast_sm PDU
 */
export interface CancelBroadcastSmPDU extends BasePDU {
  command: 'cancel_broadcast_sm';
  service_type: string;
  message_id: string;
  source_addr_ton: number;
  source_addr_npi: number;
  source_addr: string;
}

/**
 * cancel_broadcast_sm_resp PDU
 */
export interface CancelBroadcastSmRespPDU extends BasePDU {
  command: 'cancel_broadcast_sm_resp';
}

/**
 * cancel_sm PDU
 */
export interface CancelSmPDU extends BasePDU {
  command: 'cancel_sm';
  service_type: string;
  message_id: string;
  source_addr_ton: number;
  source_addr_npi: number;
  source_addr: string;
  dest_addr_ton: number;
  dest_addr_npi: number;
  destination_addr: string;
}

/**
 * cancel_sm_resp PDU
 */
export interface CancelSmRespPDU extends BasePDU {
  command: 'cancel_sm_resp';
}

/**
 * data_sm PDU
 */
export interface DataSmPDU extends BasePDU {
  command: 'data_sm';
  service_type: string;
  source_addr_ton: number;
  source_addr_npi: number;
  source_addr: string;
  dest_addr_ton: number;
  dest_addr_npi: number;
  destination_addr: string;
  esm_class: number;
  registered_delivery: number;
  data_coding: number | null;
}

/**
 * data_sm_resp PDU
 */
export interface DataSmRespPDU extends BasePDU {
  command: 'data_sm_resp';
  message_id: string;
}

/**
 * deliver_sm PDU
 */
export interface DeliverSmPDU extends BasePDU {
  command: 'deliver_sm';
  service_type: string;
  source_addr_ton: number;
  source_addr_npi: number;
  source_addr: string;
  dest_addr_ton: number;
  dest_addr_npi: number;
  destination_addr: string;
  esm_class: number;
  protocol_id: number;
  priority_flag: number;
  schedule_delivery_time: string | Date;
  validity_period: string | Date;
  registered_delivery: number;
  replace_if_present_flag: number;
  data_coding: number | null;
  sm_default_msg_id: number;
  short_message: ShortMessage;
}

/**
 * deliver_sm_resp PDU
 */
export interface DeliverSmRespPDU extends BasePDU {
  command: 'deliver_sm_resp';
  message_id: string;
}

/**
 * enquire_link PDU
 */
export interface EnquireLinkPDU extends BasePDU {
  command: 'enquire_link';
}

/**
 * enquire_link_resp PDU
 */
export interface EnquireLinkRespPDU extends BasePDU {
  command: 'enquire_link_resp';
}

/**
 * generic_nack PDU
 */
export interface GenericNackPDU extends BasePDU {
  command: 'generic_nack';
}

/**
 * outbind PDU
 */
export interface OutbindPDU extends BasePDU {
  command: 'outbind';
  system_id: string;
  password: string;
}

/**
 * query_broadcast_sm PDU
 */
export interface QueryBroadcastSmPDU extends BasePDU {
  command: 'query_broadcast_sm';
  message_id: string;
  source_addr_ton: number;
  source_addr_npi: number;
  source_addr: string;
}

/**
 * query_broadcast_sm_resp PDU
 */
export interface QueryBroadcastSmRespPDU extends BasePDU {
  command: 'query_broadcast_sm_resp';
  message_id: string;
}

/**
 * query_sm PDU
 */
export interface QuerySmPDU extends BasePDU {
  command: 'query_sm';
  message_id: string;
  source_addr_ton: number;
  source_addr_npi: number;
  source_addr: string;
}

/**
 * query_sm_resp PDU
 */
export interface QuerySmRespPDU extends BasePDU {
  command: 'query_sm_resp';
  message_id: string;
  final_date: string | Date;
  message_state: number;
  error_code: number;
}

/**
 * replace_sm PDU
 */
export interface ReplaceSmPDU extends BasePDU {
  command: 'replace_sm';
  message_id: string;
  source_addr_ton: number;
  source_addr_npi: number;
  source_addr: string;
  schedule_delivery_time: string | Date;
  validity_period: string | Date;
  registered_delivery: number;
  sm_default_msg_id: number;
  short_message: ShortMessage;
}

/**
 * replace_sm_resp PDU
 */
export interface ReplaceSmRespPDU extends BasePDU {
  command: 'replace_sm_resp';
}

/**
 * submit_multi PDU
 */
export interface SubmitMultiPDU extends BasePDU {
  command: 'submit_multi';
  service_type: string;
  source_addr_ton: number;
  source_addr_npi: number;
  source_addr: string;
  dest_address: DestAddress[];
  esm_class: number;
  protocol_id: number;
  priority_flag: number;
  schedule_delivery_time: string | Date;
  validity_period: string | Date;
  registered_delivery: number;
  replace_if_present_flag: number;
  data_coding: number | null;
  sm_default_msg_id: number;
  short_message: ShortMessage;
}

/**
 * submit_multi_resp PDU
 */
export interface SubmitMultiRespPDU extends BasePDU {
  command: 'submit_multi_resp';
  message_id: string;
  unsuccess_sme: UnsuccessSme[];
}

/**
 * submit_sm PDU
 */
export interface SubmitSmPDU extends BasePDU {
  command: 'submit_sm';
  service_type: string;
  source_addr_ton: number;
  source_addr_npi: number;
  source_addr: string;
  dest_addr_ton: number;
  dest_addr_npi: number;
  destination_addr: string;
  esm_class: number;
  protocol_id: number;
  priority_flag: number;
  schedule_delivery_time: string | Date;
  validity_period: string | Date;
  registered_delivery: number;
  replace_if_present_flag: number;
  data_coding: number | null;
  sm_default_msg_id: number;
  short_message: ShortMessage;
  // Optional TLV fields for concatenation (SAR)
  sar_msg_ref_num?: number;
  sar_total_segments?: number;
  sar_segment_seqnum?: number;
}

/**
 * submit_sm_resp PDU
 */
export interface SubmitSmRespPDU extends BasePDU {
  command: 'submit_sm_resp';
  message_id: string;
}

/**
 * unbind PDU
 */
export interface UnbindPDU extends BasePDU {
  command: 'unbind';
}

/**
 * unbind_resp PDU
 */
export interface UnbindRespPDU extends BasePDU {
  command: 'unbind_resp';
}

// ========== Union Type ==========

/**
 * Union of all PDU types
 */
export type AnyPDU =
  | AlertNotificationPDU
  | BindReceiverPDU
  | BindReceiverRespPDU
  | BindTransmitterPDU
  | BindTransmitterRespPDU
  | BindTransceiverPDU
  | BindTransceiverRespPDU
  | BroadcastSmPDU
  | BroadcastSmRespPDU
  | CancelBroadcastSmPDU
  | CancelBroadcastSmRespPDU
  | CancelSmPDU
  | CancelSmRespPDU
  | DataSmPDU
  | DataSmRespPDU
  | DeliverSmPDU
  | DeliverSmRespPDU
  | EnquireLinkPDU
  | EnquireLinkRespPDU
  | GenericNackPDU
  | OutbindPDU
  | QueryBroadcastSmPDU
  | QueryBroadcastSmRespPDU
  | QuerySmPDU
  | QuerySmRespPDU
  | ReplaceSmPDU
  | ReplaceSmRespPDU
  | SubmitMultiPDU
  | SubmitMultiRespPDU
  | SubmitSmPDU
  | SubmitSmRespPDU
  | UnbindPDU
  | UnbindRespPDU;

// ========== Session Event Map ==========

/**
 * Maps session event names to their callback argument types.
 * Used for type-safe event handling on Session instances.
 */
export type SessionEventMap = {
  // PDU events (all 28 commands)
  alert_notification: AlertNotificationPDU;
  bind_receiver: BindReceiverPDU;
  bind_receiver_resp: BindReceiverRespPDU;
  bind_transmitter: BindTransmitterPDU;
  bind_transmitter_resp: BindTransmitterRespPDU;
  bind_transceiver: BindTransceiverPDU;
  bind_transceiver_resp: BindTransceiverRespPDU;
  broadcast_sm: BroadcastSmPDU;
  broadcast_sm_resp: BroadcastSmRespPDU;
  cancel_broadcast_sm: CancelBroadcastSmPDU;
  cancel_broadcast_sm_resp: CancelBroadcastSmRespPDU;
  cancel_sm: CancelSmPDU;
  cancel_sm_resp: CancelSmRespPDU;
  data_sm: DataSmPDU;
  data_sm_resp: DataSmRespPDU;
  deliver_sm: DeliverSmPDU;
  deliver_sm_resp: DeliverSmRespPDU;
  enquire_link: EnquireLinkPDU;
  enquire_link_resp: EnquireLinkRespPDU;
  generic_nack: GenericNackPDU;
  outbind: OutbindPDU;
  query_broadcast_sm: QueryBroadcastSmPDU;
  query_broadcast_sm_resp: QueryBroadcastSmRespPDU;
  query_sm: QuerySmPDU;
  query_sm_resp: QuerySmRespPDU;
  replace_sm: ReplaceSmPDU;
  replace_sm_resp: ReplaceSmRespPDU;
  submit_multi: SubmitMultiPDU;
  submit_multi_resp: SubmitMultiRespPDU;
  submit_sm: SubmitSmPDU;
  submit_sm_resp: SubmitSmRespPDU;
  unbind: UnbindPDU;
  unbind_resp: UnbindRespPDU;

  // Non-PDU events
  connect: void;
  secureConnect: void;
  close: void;
  error: Error;
  pdu: AnyPDU;
  send: AnyPDU;
};
