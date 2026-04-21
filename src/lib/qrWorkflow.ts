import { supabase } from '@/integrations/supabase/client';

export async function recordQrWorkflowStep(params: {
  actorStaffId: string | null;
  nextStaffId?: string | null;
  shipmentId?: string | null;
  manifestId?: string | null;
  deliveryId?: string | null;
  processStep: string;
  territoryCode?: string | null;
  scanChannel?: 'qr_scanner' | 'mobile_scanner' | 'manual_override';
  notes?: string | null;
  eventPayload?: Record<string, unknown>;
  locationPayload?: Record<string, unknown>;
}) {
  const {
    actorStaffId,
    nextStaffId = null,
    shipmentId = null,
    manifestId = null,
    deliveryId = null,
    processStep,
    territoryCode = null,
    scanChannel = 'qr_scanner',
    notes = null,
    eventPayload = {},
    locationPayload = {},
  } = params;

  const { data, error } = await supabase.rpc('log_qr_scan_event', {
    p_actor_staff_id: actorStaffId,
    p_next_staff_id: nextStaffId,
    p_process_step: processStep,
    p_shipment_id: shipmentId,
    p_manifest_id: manifestId,
    p_delivery_id: deliveryId,
    p_territory_code: territoryCode,
    p_scan_channel: scanChannel,
    p_notes: notes,
    p_event_payload: eventPayload,
    p_location_payload: locationPayload,
  });

  if (error) throw error;
  return data as string;
}

export async function acknowledgeWorkflow(id: string, status: 'accepted' | 'completed' | 'rejected', notes?: string) {
  const patch: Record<string, unknown> = {
    status,
    notes: notes || null,
    updated_at: new Date().toISOString(),
  };

  if (status === 'accepted') patch.accepted_at = new Date().toISOString();
  if (status === 'completed') patch.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from('workflow_acknowledgements')
    .update(patch)
    .eq('id', id);

  if (error) throw error;
}

export async function bumpReminder(id: string) {
  const { data, error } = await supabase
    .from('workflow_acknowledgements')
    .select('reminder_count')
    .eq('id', id)
    .single();

  if (error) throw error;

  const { error: updateError } = await supabase
    .from('workflow_acknowledgements')
    .update({
      reminder_count: Number(data?.reminder_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) throw updateError;
}
