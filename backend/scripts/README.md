# Backend Scripts

## migrate-review-likes-actor-key.sql

**Ne zaman:** `school_review_likes` tablosunda mevcut veri varsa ve `actor_key` kolonu eklenmeden önce.

**Nasıl çalıştırılır:**
```bash
# PostgreSQL'e bağlan ve script'i çalıştır
psql -h 127.0.0.1 -p 5432 -U postgres -d ogretmenpro -f scripts/migrate-review-likes-actor-key.sql
```

Veya Docker kullanıyorsanız:
```bash
docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro < backend/scripts/migrate-review-likes-actor-key.sql
```

Tabloda veri yoksa bu script gerekmez; TypeORM `synchronize` yeterlidir.
