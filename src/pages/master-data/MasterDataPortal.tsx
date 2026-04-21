// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CarFront,
  ClipboardList,
  Database,
  PackageSearch,
  QrCode,
  RefreshCw,
  ScanLine,
  Save,
  ShieldCheck,
  Users2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import { acknowledgeWorkflow, bumpReminder, recordQrWorkflowStep } from '@/lib/qrWorkflow';
import { safeText } from '@/lib/displayValue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

function tt(language: string, en: string, mm: string) {
  return language === 'mm' ? mm : en;
}

function currentViewFromPath(pathname: string) {
  if (pathname.includes('/vehicles')) return 'vehicles';
  if (pathname.includes('/assets')) return 'assets';
  if (pathname.includes('/assignments')) return 'assignments';
  if (pathname.includes('/scans')) return 'scans';
  if (pathname.includes('/acknowledgements')) return 'acknowledgements';
  return 'staff';
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function fmtJson(value: unknown) {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return '{}';
  }
}

function bannerImage(view: string) {
  const map: Record<string, string> = {
    staff: '/images/b1.png',
    vehicles: '/images/b2.png',
    assets: '/images/b3.png',
    assignments: '/images/b4.png',
    scans: '/images/b5.png',
    acknowledgements: '/images/b6.png',
  };
  return map[view] || '/images/b1.png';
}

const ROUTES: Record<string, string> = {
  staff: '/master-data/staff',
  vehicles: '/master-data/vehicles',
  assets: '/master-data/assets',
  assignments: '/master-data/assignments',
  scans: '/master-data/scans',
  acknowledgements: '/master-data/acknowledgements',
};

export default function MasterDataPortal() {
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [view, setView] = useState(currentViewFromPath(location.pathname));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [staffRows, setStaffRows] = useState<any[]>([]);
  const [vehicleRows, setVehicleRows] = useState<any[]>([]);
  const [assetRows, setAssetRows] = useState<any[]>([]);
  const [assignmentRows, setAssignmentRows] = useState<any[]>([]);
  const [scanRows, setScanRows] = useState<any[]>([]);
  const [ackRows, setAckRows] = useState<any[]>([]);
  const [warehouseRows, setWarehouseRows] = useState<any[]>([]);
  const [shipmentRows, setShipmentRows] = useState<any[]>([]);

  const [staffForm, setStaffForm] = useState({
    staff_code: '',
    full_name: '',
    staff_type: 'driver',
    role_name: 'driver',
    phone: '',
    email: '',
    branch_name: '',
    warehouse_id: '',
  });

  const [vehicleForm, setVehicleForm] = useState({
    vehicle_code: '',
    registration_no: '',
    vehicle_type: 'motorbike',
    display_name: '',
    capacity_kg: '0',
    warehouse_id: '',
  });

  const [assetForm, setAssetForm] = useState({
    asset_code: '',
    asset_type: 'scanner',
    model_name: '',
    serial_no: '',
  });

  const [assignmentForm, setAssignmentForm] = useState({
    staff_id: '',
    asset_id: '',
    vehicle_id: '',
    notes: '',
  });

  const [scanForm, setScanForm] = useState({
    actor_staff_id: '',
    next_staff_id: '',
    shipment_id: '',
    process_step: 'handover',
    territory_code: '',
    scan_channel: 'qr_scanner',
    notes: '',
  });

  useEffect(() => {
    setView(currentViewFromPath(location.pathname));
  }, [location.pathname]);

  async function loadData() {
    setLoading(true);
    try {
      const [staffRes, vehicleRes, assetRes, assignmentRes, scanRes, ackRes, whRes, shipRes] = await Promise.all([
        supabase.from('staff_master').select('*').order('created_at', { ascending: false }),
        supabase.from('vehicle_master').select('*').order('created_at', { ascending: false }),
        supabase.from('asset_master').select('*').order('created_at', { ascending: false }),
        supabase.from('staff_asset_assignments').select('*').order('created_at', { ascending: false }),
        supabase.from('qr_scan_events').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('workflow_acknowledgements').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('warehouses').select('id, name, code').order('name', { ascending: true }),
        supabase.from('shipments').select('id, awb, recipient').order('created_at', { ascending: false }).limit(100),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (vehicleRes.error) throw vehicleRes.error;
      if (assetRes.error) throw assetRes.error;
      if (assignmentRes.error) throw assignmentRes.error;
      if (scanRes.error) throw scanRes.error;
      if (ackRes.error) throw ackRes.error;
      if (whRes.error) throw whRes.error;
      if (shipRes.error) throw shipRes.error;

      setStaffRows(staffRes.data || []);
      setVehicleRows(vehicleRes.data || []);
      setAssetRows(assetRes.data || []);
      setAssignmentRows(assignmentRes.data || []);
      setScanRows(scanRes.data || []);
      setAckRows(ackRes.data || []);
      setWarehouseRows(whRes.data || []);
      setShipmentRows(shipRes.data || []);
    } catch (e) {
      console.error(e);
      setStaffRows([]);
      setVehicleRows([]);
      setAssetRows([]);
      setAssignmentRows([]);
      setScanRows([]);
      setAckRows([]);
      setWarehouseRows([]);
      setShipmentRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const staffMap = useMemo(() => new Map(staffRows.map((r: any) => [r.id, r])), [staffRows]);
  const vehicleMap = useMemo(() => new Map(vehicleRows.map((r: any) => [r.id, r])), [vehicleRows]);
  const assetMap = useMemo(() => new Map(assetRows.map((r: any) => [r.id, r])), [assetRows]);
  const shipmentMap = useMemo(() => new Map(shipmentRows.map((r: any) => [r.id, r])), [shipmentRows]);

  async function createStaff() {
    setSaving(true);
    try {
      const { error } = await supabase.from('staff_master').insert({
        ...staffForm,
        warehouse_id: staffForm.warehouse_id || null,
        phone: staffForm.phone || null,
        email: staffForm.email || null,
        branch_name: staffForm.branch_name || null,
      });
      if (error) throw error;
      setStaffForm({
        staff_code: '',
        full_name: '',
        staff_type: 'driver',
        role_name: 'driver',
        phone: '',
        email: '',
        branch_name: '',
        warehouse_id: '',
      });
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function createVehicle() {
    setSaving(true);
    try {
      const { error } = await supabase.from('vehicle_master').insert({
        ...vehicleForm,
        capacity_kg: Number(vehicleForm.capacity_kg || 0),
        registration_no: vehicleForm.registration_no || null,
        display_name: vehicleForm.display_name || null,
        warehouse_id: vehicleForm.warehouse_id || null,
      });
      if (error) throw error;
      setVehicleForm({
        vehicle_code: '',
        registration_no: '',
        vehicle_type: 'motorbike',
        display_name: '',
        capacity_kg: '0',
        warehouse_id: '',
      });
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function createAsset() {
    setSaving(true);
    try {
      const { error } = await supabase.from('asset_master').insert({
        ...assetForm,
        model_name: assetForm.model_name || null,
        serial_no: assetForm.serial_no || null,
      });
      if (error) throw error;
      setAssetForm({
        asset_code: '',
        asset_type: 'scanner',
        model_name: '',
        serial_no: '',
      });
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function createAssignment() {
    setSaving(true);
    try {
      const { error } = await supabase.from('staff_asset_assignments').insert({
        staff_id: assignmentForm.staff_id,
        asset_id: assignmentForm.asset_id || null,
        vehicle_id: assignmentForm.vehicle_id || null,
        notes: assignmentForm.notes || null,
        status: 'assigned',
      });
      if (error) throw error;
      setAssignmentForm({
        staff_id: '',
        asset_id: '',
        vehicle_id: '',
        notes: '',
      });
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function createScan() {
    setSaving(true);
    try {
      await recordQrWorkflowStep({
        actorStaffId: scanForm.actor_staff_id || null,
        nextStaffId: scanForm.next_staff_id || null,
        shipmentId: scanForm.shipment_id || null,
        processStep: scanForm.process_step,
        territoryCode: scanForm.territory_code || null,
        scanChannel: scanForm.scan_channel as any,
        notes: scanForm.notes || null,
      });

      setScanForm({
        actor_staff_id: '',
        next_staff_id: '',
        shipment_id: '',
        process_step: 'handover',
        territory_code: '',
        scan_channel: 'qr_scanner',
        notes: '',
      });
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function updateAck(id: string, status: 'accepted' | 'completed' | 'rejected') {
    setSaving(true);
    try {
      await acknowledgeWorkflow(id, status);
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function remindAck(id: string) {
    setSaving(true);
    try {
      await bumpReminder(id);
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const titles: Record<string, { title: string; subtitle: string }> = {
    staff: {
      title: tt(language, 'Master Data — Staff', 'Master Data — ဝန်ထမ်း'),
      subtitle: tt(language, 'Driver, rider, helper, and other staff definitions.', 'driver, rider, helper နှင့် အခြားဝန်ထမ်း မူလအချက်အလက်များ'),
    },
    vehicles: {
      title: tt(language, 'Master Data — Vehicles', 'Master Data — ယာဉ်များ'),
      subtitle: tt(language, 'Motorbikes, bicycles, vans, trucks, and assignment-ready vehicles.', 'motorbike, bicycle, van, truck နှင့် assignment-ready ယာဉ်များ'),
    },
    assets: {
      title: tt(language, 'Master Data — Assets', 'Master Data — ပစ္စည်းများ'),
      subtitle: tt(language, 'Scanners, phones, printers, signature pads, and other controlled assets.', 'scanner, phone, printer, signature pad နှင့် အခြား controlled assets'),
    },
    assignments: {
      title: tt(language, 'Master Data — Assignments', 'Master Data — ခန့်ထားမှုများ'),
      subtitle: tt(language, 'Assign vehicles and assets to staff with accountability.', 'ယာဉ်နှင့်ပစ္စည်းများကို staff များထံ တာဝန်ယူမှုနှင့်အတူ ခန့်ထားရန်'),
    },
    scans: {
      title: tt(language, 'QR Workflow Events', 'QR Workflow Events'),
      subtitle: tt(language, 'Every handoff/process step can be recorded by QR/mobile scanner.', 'handoff / process step တိုင်းကို QR/mobile scanner ဖြင့် မှတ်တမ်းတင်နိုင်သည်'),
    },
    acknowledgements: {
      title: tt(language, 'Workflow Acknowledgements', 'Workflow Acknowledgements'),
      subtitle: tt(language, 'Pending acceptance/completion records for next responsible staff.', 'နောက်ထပ် တာဝန်ယူမည့် staff အတွက် acceptance/completion မှတ်တမ်းများ'),
    },
  };

  return (
    <div className="space-y-6">
      <div
        className="relative overflow-hidden rounded-3xl border bg-cover bg-center p-8"
        style={{ backgroundImage: `linear-gradient(rgba(255,255,255,.82), rgba(255,255,255,.90)), url(${bannerImage(view)})` }}
      >
        <div className="relative z-10">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            {tt(language, 'Master Data', 'မူလအချက်အလက်')}
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{titles[view].title}</h1>
          <p className="mt-2 text-muted-foreground">{titles[view].subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {tt(language, 'Refresh', 'ပြန်လည်ရယူမည်')}
        </Button>
      </div>

      <div className="grid gap-2 rounded-2xl bg-muted p-1 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['staff', Users2, tt(language, 'Staff', 'ဝန်ထမ်း')],
          ['vehicles', CarFront, tt(language, 'Vehicles', 'ယာဉ်များ')],
          ['assets', PackageSearch, tt(language, 'Assets', 'ပစ္စည်းများ')],
          ['assignments', ClipboardList, tt(language, 'Assignments', 'ခန့်ထားမှုများ')],
          ['scans', ScanLine, tt(language, 'QR Scans', 'QR Scans')],
          ['acknowledgements', ShieldCheck, tt(language, 'Acknowledgements', 'Acknowledgements')],
        ].map(([key, Icon, label]) => (
          <button
            key={String(key)}
            type="button"
            onClick={() => {
              setView(String(key));
              navigate(ROUTES[String(key)]);
            }}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${view === key ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {view === 'staff' && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{tt(language, 'Create Staff', 'ဝန်ထမ်းအသစ်ဖန်တီးရန်')}</CardTitle>
              <CardDescription>{tt(language, 'Production staff master entry.', 'production staff master entry')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder={tt(language, 'Staff Code', 'Staff Code')} value={staffForm.staff_code} onChange={(e) => setStaffForm({ ...staffForm, staff_code: e.target.value })} />
              <Input placeholder={tt(language, 'Full Name', 'အမည်အပြည့်အစုံ')} value={staffForm.full_name} onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })} />
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={staffForm.staff_type} onChange={(e) => setStaffForm({ ...staffForm, staff_type: e.target.value })}>
                <option value="driver">Driver</option>
                <option value="rider">Rider</option>
                <option value="helper">Helper</option>
                <option value="warehouse">Warehouse</option>
                <option value="customer-service">Customer Service</option>
                <option value="finance">Finance</option>
                <option value="hr">HR</option>
                <option value="marketing">Marketing</option>
                <option value="supervisor">Supervisor</option>
                <option value="branch-office">Branch Office</option>
                <option value="admin">Admin</option>
                <option value="other">Other</option>
              </select>
              <Input placeholder={tt(language, 'Role Name', 'Role Name')} value={staffForm.role_name} onChange={(e) => setStaffForm({ ...staffForm, role_name: e.target.value })} />
              <Input placeholder={tt(language, 'Phone', 'ဖုန်း')} value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} />
              <Input placeholder={tt(language, 'Email', 'အီးမေးလ်')} value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} />
              <Input placeholder={tt(language, 'Branch Name', 'ရုံးခွဲအမည်')} value={staffForm.branch_name} onChange={(e) => setStaffForm({ ...staffForm, branch_name: e.target.value })} />
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={staffForm.warehouse_id} onChange={(e) => setStaffForm({ ...staffForm, warehouse_id: e.target.value })}>
                <option value="">{tt(language, 'No Warehouse', 'Warehouse မချိတ်ဆက်ပါ')}</option>
                {warehouseRows.map((wh: any) => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
              </select>
              <Button onClick={createStaff} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {tt(language, 'Save Staff', 'ဝန်ထမ်းသိမ်းမည်')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tt(language, 'Staff Register', 'ဝန်ထမ်းစာရင်း')}</CardTitle>
              <CardDescription>{tt(language, 'Live staff master data.', 'live staff master data')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {staffRows.map((row: any) => (
                <div key={row.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{row.full_name}</div>
                      <div className="text-sm text-muted-foreground">{row.staff_code} · {safeText(row.role_name)}</div>
                      <div className="text-sm text-muted-foreground">{safeText(row.phone)} · {safeText(row.email)}</div>
                    </div>
                    <Badge variant={row.is_active ? 'default' : 'destructive'}>{row.is_active ? tt(language, 'Active', 'Active') : tt(language, 'Inactive', 'Inactive')}</Badge>
                  </div>
                </div>
              ))}
              {!staffRows.length && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{tt(language, 'No staff master records.', 'staff master record မရှိပါ')}</div>}
            </CardContent>
          </Card>
        </div>
      )}

      {view === 'vehicles' && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{tt(language, 'Create Vehicle', 'ယာဉ်အသစ်ဖန်တီးရန်')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder={tt(language, 'Vehicle Code', 'Vehicle Code')} value={vehicleForm.vehicle_code} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_code: e.target.value })} />
              <Input placeholder={tt(language, 'Registration No', 'ယာဉ်မှတ်ပုံတင်နံပါတ်')} value={vehicleForm.registration_no} onChange={(e) => setVehicleForm({ ...vehicleForm, registration_no: e.target.value })} />
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={vehicleForm.vehicle_type} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })}>
                <option value="bicycle">Bicycle</option>
                <option value="motorbike">Motorbike</option>
                <option value="van">Van</option>
                <option value="truck">Truck</option>
                <option value="car">Car</option>
                <option value="other">Other</option>
              </select>
              <Input placeholder={tt(language, 'Display Name', 'ဖော်ပြမည့်အမည်')} value={vehicleForm.display_name} onChange={(e) => setVehicleForm({ ...vehicleForm, display_name: e.target.value })} />
              <Input placeholder={tt(language, 'Capacity KG', 'အလေးချိန်စွမ်းရည် KG')} value={vehicleForm.capacity_kg} onChange={(e) => setVehicleForm({ ...vehicleForm, capacity_kg: e.target.value })} />
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={vehicleForm.warehouse_id} onChange={(e) => setVehicleForm({ ...vehicleForm, warehouse_id: e.target.value })}>
                <option value="">{tt(language, 'No Warehouse', 'Warehouse မချိတ်ဆက်ပါ')}</option>
                {warehouseRows.map((wh: any) => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
              </select>
              <Button onClick={createVehicle} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {tt(language, 'Save Vehicle', 'ယာဉ်သိမ်းမည်')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tt(language, 'Vehicle Register', 'ယာဉ်စာရင်း')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {vehicleRows.map((row: any) => (
                <div key={row.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{safeText(row.display_name, row.vehicle_code)}</div>
                      <div className="text-sm text-muted-foreground">{row.vehicle_code} · {safeText(row.registration_no)} · {safeText(row.vehicle_type)}</div>
                      <div className="text-sm text-muted-foreground">{tt(language, 'Capacity', 'စွမ်းရည်')}: {row.capacity_kg || 0} kg</div>
                    </div>
                    <Badge variant="secondary">{safeText(row.status)}</Badge>
                  </div>
                </div>
              ))}
              {!vehicleRows.length && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{tt(language, 'No vehicle master records.', 'vehicle master record မရှိပါ')}</div>}
            </CardContent>
          </Card>
        </div>
      )}

      {view === 'assets' && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{tt(language, 'Create Asset', 'ပစ္စည်းအသစ်ဖန်တီးရန်')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder={tt(language, 'Asset Code', 'Asset Code')} value={assetForm.asset_code} onChange={(e) => setAssetForm({ ...assetForm, asset_code: e.target.value })} />
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={assetForm.asset_type} onChange={(e) => setAssetForm({ ...assetForm, asset_type: e.target.value })}>
                <option value="scanner">Scanner</option>
                <option value="mobile-phone">Mobile Phone</option>
                <option value="helmet">Helmet</option>
                <option value="bag">Bag</option>
                <option value="printer">Printer</option>
                <option value="signature-pad">Signature Pad</option>
                <option value="camera">Camera</option>
                <option value="sim-card">SIM Card</option>
                <option value="uniform">Uniform</option>
                <option value="other">Other</option>
              </select>
              <Input placeholder={tt(language, 'Model Name', 'Model Name')} value={assetForm.model_name} onChange={(e) => setAssetForm({ ...assetForm, model_name: e.target.value })} />
              <Input placeholder={tt(language, 'Serial No', 'Serial No')} value={assetForm.serial_no} onChange={(e) => setAssetForm({ ...assetForm, serial_no: e.target.value })} />
              <Button onClick={createAsset} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {tt(language, 'Save Asset', 'ပစ္စည်းသိမ်းမည်')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tt(language, 'Asset Register', 'ပစ္စည်းစာရင်း')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assetRows.map((row: any) => (
                <div key={row.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{row.asset_code}</div>
                      <div className="text-sm text-muted-foreground">{safeText(row.asset_type)} · {safeText(row.model_name)} · {safeText(row.serial_no)}</div>
                    </div>
                    <Badge variant="secondary">{safeText(row.status)}</Badge>
                  </div>
                </div>
              ))}
              {!assetRows.length && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{tt(language, 'No asset master records.', 'asset master record မရှိပါ')}</div>}
            </CardContent>
          </Card>
        </div>
      )}

      {view === 'assignments' && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{tt(language, 'Create Assignment', 'ခန့်ထားမှုအသစ်ဖန်တီးရန်')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={assignmentForm.staff_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, staff_id: e.target.value })}>
                <option value="">{tt(language, 'Select Staff', 'ဝန်ထမ်းရွေးပါ')}</option>
                {staffRows.map((row: any) => <option key={row.id} value={row.id}>{row.full_name} · {row.staff_code}</option>)}
              </select>
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={assignmentForm.asset_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, asset_id: e.target.value })}>
                <option value="">{tt(language, 'No Asset', 'ပစ္စည်းမရွေးပါ')}</option>
                {assetRows.map((row: any) => <option key={row.id} value={row.id}>{row.asset_code} · {safeText(row.asset_type)}</option>)}
              </select>
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={assignmentForm.vehicle_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, vehicle_id: e.target.value })}>
                <option value="">{tt(language, 'No Vehicle', 'ယာဉ်မရွေးပါ')}</option>
                {vehicleRows.map((row: any) => <option key={row.id} value={row.id}>{row.vehicle_code} · {safeText(row.registration_no)}</option>)}
              </select>
              <textarea className="min-h-[110px] w-full rounded-md border p-3 text-sm" placeholder={tt(language, 'Notes', 'မှတ်ချက်')} value={assignmentForm.notes} onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })} />
              <Button onClick={createAssignment} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {tt(language, 'Save Assignment', 'ခန့်ထားမှုသိမ်းမည်')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tt(language, 'Assignment Ledger', 'ခန့်ထားမှုစာရင်း')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignmentRows.map((row: any) => (
                <div key={row.id} className="rounded-xl border p-4">
                  <div className="font-semibold">{staffMap.get(row.staff_id)?.full_name || 'Unknown staff'}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {assetMap.get(row.asset_id)?.asset_code || tt(language, 'No asset', 'ပစ္စည်းမရှိ')} · {vehicleMap.get(row.vehicle_id)?.vehicle_code || tt(language, 'No vehicle', 'ယာဉ်မရှိ')}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{fmtDate(row.assigned_at)} · {safeText(row.status)}</div>
                </div>
              ))}
              {!assignmentRows.length && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{tt(language, 'No assignments.', 'ခန့်ထားမှုမရှိပါ')}</div>}
            </CardContent>
          </Card>
        </div>
      )}

      {view === 'scans' && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{tt(language, 'Log QR Workflow Step', 'QR Workflow Step မှတ်တမ်းတင်ရန်')}</CardTitle>
              <CardDescription>{tt(language, 'This is the production foundation for scan-based responsibility transfer.', 'scan-based responsibility transfer အတွက် production foundation')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={scanForm.actor_staff_id} onChange={(e) => setScanForm({ ...scanForm, actor_staff_id: e.target.value })}>
                <option value="">{tt(language, 'Actor Staff', 'လုပ်ဆောင်သူ staff')}</option>
                {staffRows.map((row: any) => <option key={row.id} value={row.id}>{row.full_name}</option>)}
              </select>
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={scanForm.next_staff_id} onChange={(e) => setScanForm({ ...scanForm, next_staff_id: e.target.value })}>
                <option value="">{tt(language, 'Next Responsible Staff', 'နောက်ထပ် တာဝန်ယူမည့် staff')}</option>
                {staffRows.map((row: any) => <option key={row.id} value={row.id}>{row.full_name}</option>)}
              </select>
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={scanForm.shipment_id} onChange={(e) => setScanForm({ ...scanForm, shipment_id: e.target.value })}>
                <option value="">{tt(language, 'Select Shipment', 'Shipment ရွေးပါ')}</option>
                {shipmentRows.map((row: any) => <option key={row.id} value={row.id}>{row.awb} · {safeText(row.recipient?.name)}</option>)}
              </select>
              <Input placeholder={tt(language, 'Process Step (handover / inbound / sorting / dispatch)', 'Process Step')} value={scanForm.process_step} onChange={(e) => setScanForm({ ...scanForm, process_step: e.target.value })} />
              <Input placeholder={tt(language, 'Territory Code', 'Territory Code')} value={scanForm.territory_code} onChange={(e) => setScanForm({ ...scanForm, territory_code: e.target.value })} />
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={scanForm.scan_channel} onChange={(e) => setScanForm({ ...scanForm, scan_channel: e.target.value })}>
                <option value="qr_scanner">QR Scanner</option>
                <option value="mobile_scanner">Mobile Scanner</option>
                <option value="manual_override">Manual Override</option>
              </select>
              <textarea className="min-h-[110px] w-full rounded-md border p-3 text-sm" placeholder={tt(language, 'Notes', 'မှတ်ချက်')} value={scanForm.notes} onChange={(e) => setScanForm({ ...scanForm, notes: e.target.value })} />
              <Button onClick={createScan} disabled={saving}>
                <QrCode className="mr-2 h-4 w-4" />
                {tt(language, 'Record Scan Step', 'Scan Step မှတ်တမ်းတင်မည်')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tt(language, 'Latest QR Events', 'နောက်ဆုံး QR Events')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {scanRows.map((row: any) => (
                <div key={row.id} className="rounded-xl border p-4">
                  <div className="font-semibold">{safeText(row.process_step)}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {shipmentMap.get(row.shipment_id)?.awb || tt(language, 'No shipment', 'shipment မရှိ')} ·
                    {' '}{staffMap.get(row.actor_staff_id)?.full_name || tt(language, 'Unknown actor', 'မသိသေးသော actor')}
                    {' → '}
                    {staffMap.get(row.next_staff_id)?.full_name || tt(language, 'No next staff', 'နောက်ထပ် staff မသတ်မှတ်ရသေး')}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{fmtDate(row.created_at)} · {safeText(row.scan_channel)} · {safeText(row.territory_code)}</div>
                </div>
              ))}
              {!scanRows.length && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{tt(language, 'No QR workflow events yet.', 'QR workflow events မရှိသေးပါ')}</div>}
            </CardContent>
          </Card>
        </div>
      )}

      {view === 'acknowledgements' && (
        <Card>
          <CardHeader>
            <CardTitle>{tt(language, 'Workflow Acknowledgements', 'Workflow Acknowledgements')}</CardTitle>
            <CardDescription>{tt(language, 'Accept, complete, reject, or remind pending responsibility handoffs.', 'တာဝန်လွှဲပြောင်းမှုများကို accept / complete / reject / remind လုပ်နိုင်သည်')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ackRows.map((row: any) => (
              <div key={row.id} className="rounded-2xl border p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="font-semibold">{staffMap.get(row.responsible_staff_id)?.full_name || 'Unknown staff'}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {tt(language, 'Status', 'အခြေအနေ')}: {safeText(row.status)} ·
                      {' '}{tt(language, 'Due', 'Due')}: {fmtDate(row.due_at)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {tt(language, 'Reminder Count', 'Reminder Count')}: {row.reminder_count || 0}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateAck(row.id, 'accepted')} disabled={saving}>
                      {tt(language, 'Accept', 'လက်ခံမည်')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateAck(row.id, 'completed')} disabled={saving}>
                      {tt(language, 'Complete', 'ပြီးစီးကြောင်းအတည်ပြုမည်')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateAck(row.id, 'rejected')} disabled={saving}>
                      {tt(language, 'Reject', 'ငြင်းပယ်မည်')}
                    </Button>
                    <Button size="sm" onClick={() => remindAck(row.id)} disabled={saving}>
                      {tt(language, 'Remind', 'သတိပေးမည်')}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {!ackRows.length && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{tt(language, 'No workflow acknowledgements.', 'workflow acknowledgement မရှိပါ')}</div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
