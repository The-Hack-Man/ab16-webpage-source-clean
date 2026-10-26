update public.products
set description = 'White AB16 foam-front trucker cap featuring the AB16 logo.',
    seo_description = 'White foam-front AB16 trucker cap with front logo detail.',
    updated_at = now()
where slug = 'ab16-baseball-cap'
  and status = 'published';
