import { types, filters } from './defs';

export const commands = {
  alert_notification: {
    id: 0x00000102,
    params: {
      source_addr_ton: { type: types.int8 },
      source_addr_npi: { type: types.int8 },
      source_addr: { type: types.cstring },
      esme_addr_ton: { type: types.int8 },
      esme_addr_npi: { type: types.int8 },
      esme_addr: { type: types.cstring },
    },
  },
  bind_receiver: {
    id: 0x00000001,
    params: {
      system_id: { type: types.cstring },
      password: { type: types.cstring },
      system_type: { type: types.cstring },
      interface_version: { type: types.int8, default: 0x50 },
      addr_ton: { type: types.int8 },
      addr_npi: { type: types.int8 },
      address_range: { type: types.cstring },
    },
  },
  bind_receiver_resp: {
    id: 0x80000001,
    params: {
      system_id: { type: types.cstring },
    },
  },
  bind_transmitter: {
    id: 0x00000002,
    params: {
      system_id: { type: types.cstring },
      password: { type: types.cstring },
      system_type: { type: types.cstring },
      interface_version: { type: types.int8, default: 0x50 },
      addr_ton: { type: types.int8 },
      addr_npi: { type: types.int8 },
      address_range: { type: types.cstring },
    },
  },
  bind_transmitter_resp: {
    id: 0x80000002,
    params: {
      system_id: { type: types.cstring },
    },
  },
  bind_transceiver: {
    id: 0x00000009,
    params: {
      system_id: { type: types.cstring },
      password: { type: types.cstring },
      system_type: { type: types.cstring },
      interface_version: { type: types.int8, default: 0x50 },
      addr_ton: { type: types.int8 },
      addr_npi: { type: types.int8 },
      address_range: { type: types.cstring },
    },
  },
  bind_transceiver_resp: {
    id: 0x80000009,
    params: {
      system_id: { type: types.cstring },
    },
  },
  broadcast_sm: {
    id: 0x00000111,
    params: {
      service_type: { type: types.cstring },
      source_addr_ton: { type: types.int8 },
      source_addr_npi: { type: types.int8 },
      source_addr: { type: types.cstring },
      message_id: { type: types.cstring },
      priority_flag: { type: types.int8 },
      schedule_delivery_time: { type: types.cstring, filter: filters.time },
      validity_period: { type: types.cstring, filter: filters.time },
      replace_if_present_flag: { type: types.int8 },
      data_coding: { type: types.int8, default: null },
      sm_default_msg_id: { type: types.int8 },
    },
  },
  broadcast_sm_resp: {
    id: 0x80000111,
    params: {
      message_id: { type: types.cstring },
    },
    tlvMap: {
      broadcast_area_identifier: 'failed_broadcast_area_identifier',
    },
  },
  cancel_broadcast_sm: {
    id: 0x00000113,
    params: {
      service_type: { type: types.cstring },
      message_id: { type: types.cstring },
      source_addr_ton: { type: types.int8 },
      source_addr_npi: { type: types.int8 },
      source_addr: { type: types.cstring },
    },
  },
  cancel_broadcast_sm_resp: {
    id: 0x80000113,
  },
  cancel_sm: {
    id: 0x00000008,
    params: {
      service_type: { type: types.cstring },
      message_id: { type: types.cstring },
      source_addr_ton: { type: types.int8 },
      source_addr_npi: { type: types.int8 },
      source_addr: { type: types.cstring },
      dest_addr_ton: { type: types.int8 },
      dest_addr_npi: { type: types.int8 },
      destination_addr: { type: types.cstring },
    },
  },
  cancel_sm_resp: {
    id: 0x80000008,
  },
  data_sm: {
    id: 0x00000103,
    params: {
      service_type: { type: types.cstring },
      source_addr_ton: { type: types.int8 },
      source_addr_npi: { type: types.int8 },
      source_addr: { type: types.cstring },
      dest_addr_ton: { type: types.int8 },
      dest_addr_npi: { type: types.int8 },
      destination_addr: { type: types.cstring },
      esm_class: { type: types.int8 },
      registered_delivery: { type: types.int8 },
      data_coding: { type: types.int8, default: null },
    },
  },
  data_sm_resp: {
    id: 0x80000103,
    params: {
      message_id: { type: types.cstring },
    },
  },
  deliver_sm: {
    id: 0x00000005,
    params: {
      service_type: { type: types.cstring },
      source_addr_ton: { type: types.int8 },
      source_addr_npi: { type: types.int8 },
      source_addr: { type: types.cstring },
      dest_addr_ton: { type: types.int8 },
      dest_addr_npi: { type: types.int8 },
      destination_addr: { type: types.cstring },
      esm_class: { type: types.int8 },
      protocol_id: { type: types.int8 },
      priority_flag: { type: types.int8 },
      schedule_delivery_time: { type: types.cstring, filter: filters.time },
      validity_period: { type: types.cstring, filter: filters.time },
      registered_delivery: { type: types.int8 },
      replace_if_present_flag: { type: types.int8 },
      data_coding: { type: types.int8, default: null },
      sm_default_msg_id: { type: types.int8 },
      //sm_length: {type: types.int8},
      short_message: { type: types.buffer, filter: filters.message },
    },
  },
  deliver_sm_resp: {
    id: 0x80000005,
    params: {
      message_id: { type: types.cstring },
    },
  },
  enquire_link: {
    id: 0x00000015,
  },
  enquire_link_resp: {
    id: 0x80000015,
  },
  generic_nack: {
    id: 0x80000000,
  },
  outbind: {
    id: 0x0000000b,
    params: {
      system_id: { type: types.cstring },
      password: { type: types.cstring },
    },
  },
  query_broadcast_sm: {
    id: 0x00000112,
    params: {
      message_id: { type: types.cstring },
      source_addr_ton: { type: types.int8 },
      source_addr_npi: { type: types.int8 },
      source_addr: { type: types.cstring },
    },
  },
  query_broadcast_sm_resp: {
    id: 0x80000112,
    params: {
      message_id: { type: types.cstring },
    },
  },
  query_sm: {
    id: 0x00000003,
    params: {
      message_id: { type: types.cstring },
      source_addr_ton: { type: types.int8 },
      source_addr_npi: { type: types.int8 },
      source_addr: { type: types.cstring },
    },
  },
  query_sm_resp: {
    id: 0x80000003,
    params: {
      message_id: { type: types.cstring },
      final_date: { type: types.cstring, filter: filters.time },
      message_state: { type: types.int8 },
      error_code: { type: types.int8 },
    },
  },
  replace_sm: {
    id: 0x00000007,
    params: {
      message_id: { type: types.cstring },
      source_addr_ton: { type: types.int8 },
      source_addr_npi: { type: types.int8 },
      source_addr: { type: types.cstring },
      schedule_delivery_time: { type: types.cstring, filter: filters.time },
      validity_period: { type: types.cstring, filter: filters.time },
      registered_delivery: { type: types.int8 },
      sm_default_msg_id: { type: types.int8 },
      //sm_length: {type: types.int8},
      short_message: { type: types.buffer, filter: filters.message },
    },
  },
  replace_sm_resp: {
    id: 0x80000007,
  },
  submit_multi: {
    id: 0x00000021,
    params: {
      service_type: { type: types.cstring },
      source_addr_ton: { type: types.int8 },
      source_addr_npi: { type: types.int8 },
      source_addr: { type: types.cstring },
      //number_of_dests: {type: types.int8},
      dest_address: { type: types.dest_address_array },
      esm_class: { type: types.int8 },
      protocol_id: { type: types.int8 },
      priority_flag: { type: types.int8 },
      schedule_delivery_time: { type: types.cstring, filter: filters.time },
      validity_period: { type: types.cstring, filter: filters.time },
      registered_delivery: { type: types.int8 },
      replace_if_present_flag: { type: types.int8 },
      data_coding: { type: types.int8, default: null },
      sm_default_msg_id: { type: types.int8 },
      //sm_length: {type: types.int8},
      short_message: { type: types.buffer, filter: filters.message },
    },
  },
  submit_multi_resp: {
    id: 0x80000021,
    params: {
      message_id: { type: types.cstring },
      //no_unsuccess: {type: types.int8},
      unsuccess_sme: { type: types.unsuccess_sme_array },
    },
  },
  submit_sm: {
    id: 0x00000004,
    params: {
      service_type: { type: types.cstring },
      source_addr_ton: { type: types.int8 },
      source_addr_npi: { type: types.int8 },
      source_addr: { type: types.cstring },
      dest_addr_ton: { type: types.int8 },
      dest_addr_npi: { type: types.int8 },
      destination_addr: { type: types.cstring },
      esm_class: { type: types.int8 },
      protocol_id: { type: types.int8 },
      priority_flag: { type: types.int8 },
      schedule_delivery_time: { type: types.cstring, filter: filters.time },
      validity_period: { type: types.cstring, filter: filters.time },
      registered_delivery: { type: types.int8 },
      replace_if_present_flag: { type: types.int8 },
      data_coding: { type: types.int8, default: null },
      sm_default_msg_id: { type: types.int8 },
      //sm_length: {type: types.int8},
      short_message: { type: types.buffer, filter: filters.message },
    },
  },
  submit_sm_resp: {
    id: 0x80000004,
    params: {
      message_id: { type: types.cstring },
    },
  },
  unbind: {
    id: 0x00000006,
  },
  unbind_resp: {
    id: 0x80000006,
  },
} as const;

export const commandsById = {};

for (const commandName in commands) {
  commandsById[commands[commandName].id] = commands[commandName];
  commands[commandName].command = commandName;
}
