-- Repair AX snapshot import alignment loss found in source rows 23-402.
-- Source audit: 787 logical current rows, all WMSDLG. The old importer lost case_group,
-- primary_resource and primary_resource_group for a contiguous block.
WITH encoded(txt) AS (VALUES ($ranges$
23-23|MKS;24-25|BJM;26-27|PKU;28-32|BJM;33-33|PKU;34-34|PLG;35-35|BJM;36-36|JKT;37-37|BPN;38-38|BJM;39-39|JKT;40-40|MDN;41-41|JKT;42-44|BJM;45-45|JKT;46-47|BPN;48-48|PKU;49-49|BKL;50-50|BPN;51-51|BJM;52-52|JBI;53-57|MKS;58-59|SBY;60-61|BJM;62-62|JKT;63-63|MRE;64-64|JKT;65-65|PKU;66-66|MKS;67-67|BJM;68-70|SBY;71-71|PKU;72-72|PLG;73-73|JKT;74-80|BJM;81-81|BPN;82-82|MKS;83-84|PKU;85-86|BPN;87-89|JKT;90-90|BJM;91-93|MKS;94-94|BKL;95-98|BJM;99-99|LPG;100-100|JBI;101-101|BJM;102-102|MKS;103-103|BJM;104-104|MKS;105-106|MDN;107-111|JKT;112-112|PTK;113-114|BPN;115-115|BJM;116-116|MKS;117-117|PKU;118-120|PTK;121-121|JKT;122-122|SBY;123-123|BJM;124-125|JKT;126-126|SBY;127-128|JKT;129-129|PLG;130-130|LPG;131-131|PLG;132-132|BPN;133-133|PKU;134-134|BPN;135-139|JKT;140-140|PTK;141-142|BJM;143-143|LPG;144-144|MRE;145-145|MDN;146-146|MKS;147-148|BJM;149-149|PKU;150-150|MRE;151-151|PTK;152-152|MDN;153-153|BJM;154-154|PTK;155-156|BJM;157-157|SBY;158-158|LPG;159-159|BPN;160-161|MKS;162-162|BJM;163-164|PLU;165-165|PKU;166-166|PLG;167-167|PTK;168-168|MRE;169-169|PLU;170-170|PTK;171-171|MDN;172-172|PLG;173-173|BJM;174-174|BPN;175-175|PLG;176-176|PTK;177-177|BPN;178-178|BJM;179-179|LPG;180-180|PTK;181-181|SBY;182-183|PKU;184-185|PTK;186-187|BJM;188-188|PLG;189-189|PKU;190-190|JBI;191-191|PTK;192-193|BPN;194-194|LPG;195-195|MRE;196-196|PKU;197-197|BKL;198-199|BJM;200-200|BKL;201-201|BJM;202-202|PKU;203-203|PTK;204-204|PLG;205-205|LPG;206-206|PLG;207-207|LPG;208-208|JKT;209-209|PKU;210-210|BJM;211-211|BKL;212-212|PLU;213-213|MRE;214-214|PTK;215-216|MRE;217-217|PTK;218-218|BPN;219-219|PKU;220-221|BJM;222-222|LPG;223-223|BKL;224-224|BJM;225-225|PTK;226-226|SBY;227-227|BPN;228-228|PKU;229-229|PTK;230-230|PLG;231-232|MRE;233-233|PLG;234-235|BJM;236-236|SBY;237-239|MRE;240-240|SBY;241-241|BJM;242-242|BKL;243-243|MRE;244-245|LPG;246-246|PTK;247-247|BJM;248-248|LPG;249-249|PKU;250-251|LPG;252-252|BJM;253-254|BKL;255-255|BJM;256-256|BKL;257-257|JBI;258-258|MRE;259-262|JKT;263-263|SRG;264-264|MKS;265-266|JKT;267-272|BJM;273-273|MRE;274-274|JKT;275-276|BJM;277-277|JKT;278-278|BJM;279-280|JKT;281-281|BJM;282-282|JKT;283-283|BJM;284-287|JKT;288-288|PLG;289-289|MKS;290-291|BPN;292-292|JKT;293-293|LPG;294-294|SBY;295-295|MRE;296-297|JKT;298-299|BJM;300-300|PKU;301-301|JKT;302-302|BPN;303-303|MRE;304-306|JKT;307-307|PKU;308-308|SBY;309-309|KDI;310-314|PLG;315-315|BKL;316-316|MND;317-317|KDI;318-319|BPN;320-321|BJM;322-322|JKT;323-323|SRG;324-326|JKT;327-327|KDI;328-328|PKU;329-329|BJM;330-330|LPG;331-332|BJM;333-333|PLG;334-337|JKT;338-339|PLG;340-340|BKL;341-341|JKT;342-342|BJM;343-348|JKT;349-350|BPN;351-351|MND;352-352|JKT;353-353|PLG;354-354|MND;355-356|SBY;357-357|KDI;358-359|BJM;360-361|JKT;362-362|MDN;363-363|LPG;364-365|SBY;366-366|JKT;367-368|PLG;369-369|SBY;370-370|PLU;371-371|BJM;372-372|MKS;373-373|JKT;374-374|PLG;375-375|PLU;376-376|JKT;377-377|BJM;378-379|PLG;380-380|KDI;381-381|JKT;382-382|BJM;383-383|LPG;384-385|BJM;386-386|PLG;387-388|BJM;389-389|PLG;390-390|SRG;391-392|PKU;393-393|MRE;394-394|BPN;395-395|MKS;396-397|JKT;398-398|JBI;399-399|MDN;400-400|BJM;401-402|KDI
$ranges$)), parsed AS (
  SELECT split_part(item,'|',1) AS span, split_part(item,'|',2) AS code
  FROM encoded, unnest(string_to_array(txt,';')) AS item
), mapped AS (
  SELECT split_part(span,'-',1)::int start_row,
         split_part(span,'-',2)::int end_row,
         CASE code
           WHEN 'BPN' THEN 'ITR - BALIKPAPAN' WHEN 'BJM' THEN 'ITR - BANJARMASIN'
           WHEN 'BKL' THEN 'ITR - BENGKULU' WHEN 'JKT' THEN 'ITR - JAKARTA BRANCH'
           WHEN 'JBI' THEN 'ITR - JAMBI' WHEN 'KDI' THEN 'ITR - KENDARI'
           WHEN 'LPG' THEN 'ITR - LAMPUNG' WHEN 'MKS' THEN 'ITR - MAKASAR'
           WHEN 'MND' THEN 'ITR - MANADO' WHEN 'MDN' THEN 'ITR - MEDAN'
           WHEN 'MRE' THEN 'ITR - MUARA ENIM' WHEN 'PLG' THEN 'ITR - PALEMBANG'
           WHEN 'PLU' THEN 'ITR - PALU' WHEN 'PKU' THEN 'ITR - PEKANBARU'
           WHEN 'PTK' THEN 'ITR - PONTIANAK' WHEN 'SRG' THEN 'ITR - SORONG'
           WHEN 'SBY' THEN 'ITR - SURABAYA' END AS branch_name
  FROM parsed
), repaired AS (
  SELECT t.wo_no, m.branch_name,
    CASE m.branch_name
      WHEN 'ITR - BALIKPAPAN' THEN 'Bpn_Field' WHEN 'ITR - BANJARMASIN' THEN 'Banjarmasin_Field'
      WHEN 'ITR - BENGKULU' THEN 'Bengkulu_Field' WHEN 'ITR - JAKARTA BRANCH' THEN 'Jkt_Field'
      WHEN 'ITR - JAMBI' THEN 'Jambi_Field' WHEN 'ITR - KENDARI' THEN 'Kendari_Field'
      WHEN 'ITR - LAMPUNG' THEN 'ITR - LAMPUNG' WHEN 'ITR - MAKASAR' THEN 'Makasar_Field'
      WHEN 'ITR - MANADO' THEN 'Manado_Field' WHEN 'ITR - MEDAN' THEN 'Medan_Field'
      WHEN 'ITR - MUARA ENIM' THEN 'Muara Enim_Field' WHEN 'ITR - PALEMBANG' THEN 'Palembang_Field'
      WHEN 'ITR - PALU' THEN 'Palu_Field' WHEN 'ITR - PEKANBARU' THEN 'Pku _Field'
      WHEN 'ITR - PONTIANAK' THEN 'Pontianak_Field' WHEN 'ITR - SORONG' THEN 'Sorong_Field'
      WHEN 'ITR - SURABAYA' THEN 'Sby_Field' END AS primary_resource
  FROM public.ax_warranty_work_orders t JOIN mapped m ON t.source_row_number BETWEEN m.start_row AND m.end_row
  WHERE t.source_quality_status='OK' AND t.source_row_number BETWEEN 23 AND 402
)
UPDATE public.ax_warranty_work_orders t
SET case_group='WMSDLG', primary_resource_group=r.branch_name, primary_resource=r.primary_resource,
    source_quality_status='OK', source_quality_notes=NULL, updated_at=now()
FROM repaired r WHERE t.wo_no=r.wo_no;

CREATE OR REPLACE VIEW public.wo_warranty_universe_v AS
SELECT wo_no, case_group, wo_type, status AS ax_status, created_date, start_date,
  COALESCE(start_date, created_date) AS aging_anchor_date,
  CASE WHEN COALESCE(start_date, created_date) IS NULL THEN NULL::integer ELSE CURRENT_DATE - COALESCE(start_date, created_date) END AS aging_days,
  serial_no, chassis_no,
  CASE
    WHEN upper(btrim(COALESCE(primary_resource_group,'')))='ITR - JAKARTA BRANCH' THEN 'JAKARTA'
    WHEN upper(btrim(COALESCE(primary_resource_group,'')))='ITR - MAKASAR' THEN 'MAKASSAR'
    WHEN upper(btrim(COALESCE(primary_resource_group,'')))='ITR - MUARA ENIM' THEN 'TANJUNG ENIM'
    WHEN upper(btrim(COALESCE(primary_resource_group,''))) LIKE 'ITR - %' THEN btrim(substr(primary_resource_group,7)) ELSE NULL END AS branch_location,
  location2, description, customer_account, device_name, person_in_charge, primary_resource, source_quality_status,
  upper(regexp_replace(COALESCE(btrim(wo_no),''),'[^A-Za-z0-9]','','g')) AS wo_key, primary_resource_group,
  CASE
    WHEN upper(btrim(COALESCE(primary_resource_group,'')))='ITR - JAKARTA BRANCH' THEN 'JAKARTA'
    WHEN upper(btrim(COALESCE(primary_resource_group,'')))='ITR - MAKASAR' THEN 'MAKASSAR'
    WHEN upper(btrim(COALESCE(primary_resource_group,'')))='ITR - MUARA ENIM' THEN 'TANJUNG ENIM'
    WHEN upper(btrim(COALESCE(primary_resource_group,''))) LIKE 'ITR - %' THEN btrim(substr(primary_resource_group,7)) ELSE NULL END AS branch_name,
  CASE WHEN upper(btrim(COALESCE(primary_resource_group,''))) LIKE 'ITR - %' THEN 'PRIMARY_RESOURCE_GROUP' ELSE 'UNMAPPED' END AS branch_source
FROM public.ax_warranty_work_orders
WHERE source_quality_status='OK' AND upper(btrim(COALESCE(case_group,''))) LIKE 'WM%' AND upper(btrim(COALESCE(status,''))) <> 'CANCELED';
