import { filters, types } from './defs';

export const tlvs = {
  dest_addr_subunit: {
    id: 0x0005,
    type: types.tlv.int8,
  },
  dest_network_type: {
    id: 0x0006,
    type: types.tlv.int8,
  },
  dest_bearer_type: {
    id: 0x0007,
    type: types.tlv.int8,
  },
  dest_telematics_id: {
    id: 0x0008,
    type: types.tlv.int16,
  },
  source_addr_subunit: {
    id: 0x000d,
    type: types.tlv.int8,
  },
  source_network_type: {
    id: 0x000e,
    type: types.tlv.int8,
  },
  source_bearer_type: {
    id: 0x000f,
    type: types.tlv.int8,
  },
  source_telematics_id: {
    id: 0x0010,
    type: types.tlv.int16,
  },
  qos_time_to_live: {
    id: 0x0017,
    type: types.tlv.int32,
  },
  payload_type: {
    id: 0x0019,
    type: types.tlv.int8,
  },
  additional_status_info_text: {
    id: 0x001d,
    type: types.tlv.cstring,
  },
  receipted_message_id: {
    id: 0x001e,
    type: types.tlv.cstring,
  },
  ms_msg_wait_facilities: {
    id: 0x0030,
    type: types.tlv.int8,
  },
  privacy_indicator: {
    id: 0x0201,
    type: types.tlv.int8,
  },
  source_subaddress: {
    id: 0x0202,
    type: types.tlv.buffer,
  },
  dest_subaddress: {
    id: 0x0203,
    type: types.tlv.buffer,
  },
  user_message_reference: {
    id: 0x0204,
    type: types.tlv.int16,
  },
  user_response_code: {
    id: 0x0205,
    type: types.tlv.int8,
  },
  source_port: {
    id: 0x020a,
    type: types.tlv.int16,
  },
  dest_port: {
    id: 0x020b,
    type: types.tlv.int16,
  },
  sar_msg_ref_num: {
    id: 0x020c,
    type: types.tlv.int16,
  },
  language_indicator: {
    id: 0x020d,
    type: types.tlv.int8,
  },
  sar_total_segments: {
    id: 0x020e,
    type: types.tlv.int8,
  },
  sar_segment_seqnum: {
    id: 0x020f,
    type: types.tlv.int8,
  },
  sc_interface_version: {
    id: 0x0210,
    type: types.tlv.int8,
  },
  callback_num_pres_ind: {
    id: 0x0302,
    type: types.tlv.int8,
    multiple: true,
  },
  callback_num_atag: {
    id: 0x0303,
    type: types.tlv.buffer,
    filter: filters.callback_num_atag,
    multiple: true,
  },
  number_of_messages: {
    id: 0x0304,
    type: types.tlv.int8,
  },
  callback_num: {
    id: 0x0381,
    type: types.tlv.buffer,
    filter: filters.callback_num,
    multiple: true,
  },
  dpf_result: {
    id: 0x0420,
    type: types.tlv.int8,
  },
  set_dpf: {
    id: 0x0421,
    type: types.tlv.int8,
  },
  ms_availability_status: {
    id: 0x0422,
    type: types.tlv.int8,
  },
  network_error_code: {
    id: 0x0423,
    type: types.tlv.buffer,
  },
  message_payload: {
    id: 0x0424,
    type: types.tlv.buffer,
    filter: filters.message,
  },
  delivery_failure_reason: {
    id: 0x0425,
    type: types.tlv.int8,
  },
  more_messages_to_send: {
    id: 0x0426,
    type: types.tlv.int8,
  },
  message_state: {
    id: 0x0427,
    type: types.tlv.int8,
  },
  congestion_state: {
    id: 0x0428,
    type: types.tlv.int8,
  },
  ussd_service_op: {
    id: 0x0501,
    type: types.tlv.int8,
  },
  broadcast_channel_indicator: {
    id: 0x0600,
    type: types.tlv.int8,
  },
  broadcast_content_type: {
    id: 0x0601,
    type: types.tlv.buffer,
    filter: filters.broadcast_content_type,
  },
  broadcast_content_type_info: {
    id: 0x0602,
    type: types.tlv.string,
  },
  broadcast_message_class: {
    id: 0x0603,
    type: types.tlv.int8,
  },
  broadcast_rep_num: {
    id: 0x0604,
    type: types.tlv.int16,
  },
  broadcast_frequency_interval: {
    id: 0x0605,
    type: types.tlv.buffer,
    filter: filters.broadcast_frequency_interval,
  },
  broadcast_area_identifier: {
    id: 0x0606,
    type: types.tlv.buffer,
    filter: filters.broadcast_area_identifier,
    multiple: true,
  },
  broadcast_error_status: {
    id: 0x0607,
    type: types.tlv.int32,
    multiple: true,
  },
  broadcast_area_success: {
    id: 0x0608,
    type: types.tlv.int8,
  },
  broadcast_end_time: {
    id: 0x0609,
    type: types.tlv.string,
    filter: filters.time,
  },
  broadcast_service_group: {
    id: 0x060a,
    type: types.tlv.string,
  },
  billing_identification: {
    id: 0x060b,
    type: types.tlv.buffer,
    filter: filters.billing_identification,
  },
  source_network_id: {
    id: 0x060d,
    type: types.tlv.cstring,
  },
  dest_network_id: {
    id: 0x060e,
    type: types.tlv.cstring,
  },
  source_node_id: {
    id: 0x060f,
    type: types.tlv.string,
  },
  dest_node_id: {
    id: 0x0610,
    type: types.tlv.string,
  },
  dest_addr_np_resolution: {
    id: 0x0611,
    type: types.tlv.int8,
  },
  dest_addr_np_information: {
    id: 0x0612,
    type: types.tlv.string,
  },
  dest_addr_np_country: {
    id: 0x0613,
    type: types.tlv.int32,
  },
  display_time: {
    id: 0x1201,
    type: types.tlv.int8,
  },
  sms_signal: {
    id: 0x1203,
    type: types.tlv.int16,
  },
  ms_validity: {
    id: 0x1204,
    type: types.tlv.buffer,
  },
  alert_on_message_delivery: {
    id: 0x130c,
    type: types.tlv.int8,
  },
  its_reply_type: {
    id: 0x1380,
    type: types.tlv.int8,
  },
  its_session_info: {
    id: 0x1383,
    type: types.tlv.buffer,
  },
  get alert_on_msg_delivery() {
    return this.alert_on_message_delivery;
  },
  get failed_broadcast_area_identifier() {
    return this.broadcast_area_identifier;
  },
} as const;

export const tlvsById = {};

for (const tag in tlvs) {
  tlvsById[tlvs[tag].id] = tlvs[tag];
  tlvs[tag].tag = tag;
}
