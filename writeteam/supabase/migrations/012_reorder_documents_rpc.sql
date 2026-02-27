CREATE OR REPLACE FUNCTION public.reorder_documents(
  p_project_id uuid,
  p_user_id uuid,
  p_ordered_document_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_total_docs integer;
  v_total_input integer;
  v_total_unique integer;
BEGIN
  IF p_project_id IS NULL OR p_user_id IS NULL OR p_ordered_document_ids IS NULL OR array_length(p_ordered_document_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'invalid_reorder_payload';
  END IF;

  v_total_input := array_length(p_ordered_document_ids, 1);

  SELECT COUNT(DISTINCT id)
  INTO v_total_unique
  FROM unnest(p_ordered_document_ids) AS id;

  IF v_total_unique <> v_total_input THEN
    RAISE EXCEPTION 'duplicate_document_ids';
  END IF;

  SELECT COUNT(*)
  INTO v_total_docs
  FROM public.documents
  WHERE project_id = p_project_id
    AND user_id = p_user_id;

  IF v_total_docs <> v_total_input THEN
    RAISE EXCEPTION 'reorder_scope_mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_ordered_document_ids) AS id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = id
        AND d.project_id = p_project_id
        AND d.user_id = p_user_id
    )
  ) THEN
    RAISE EXCEPTION 'document_not_owned';
  END IF;

  UPDATE public.documents AS d
  SET sort_order = ordered.ord - 1,
      updated_at = now()
  FROM unnest(p_ordered_document_ids) WITH ORDINALITY AS ordered(id, ord)
  WHERE d.id = ordered.id
    AND d.project_id = p_project_id
    AND d.user_id = p_user_id;
END;
$$;
