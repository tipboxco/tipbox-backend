import { useState } from 'react';
import BadgeListByType from './BadgeListByType';
import type { BadgeTypeSlug } from './BadgeListByType';
import CreateBadgeModal from './CreateBadgeModal';

function BrandBadgesList() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <BadgeListByType
        badgeType={'BRAND' as BadgeTypeSlug}
        listPath="/gamification/brand-badges"
        title="Brand Badges"
        description="Marka badge'leri listesi ve yönetimi"
        icon="fa-tag"
        onOpenCreate={() => setCreateOpen(true)}
      />
      {createOpen && (
        <CreateBadgeModal
          badgeType="BRAND"
          listPath="/gamification/brand-badges"
          onClose={() => setCreateOpen(false)}
          onSuccess={() => setCreateOpen(false)}
        />
      )}
    </>
  );
}

export default BrandBadgesList;
