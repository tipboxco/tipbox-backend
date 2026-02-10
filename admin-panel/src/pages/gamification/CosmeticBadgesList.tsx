import { useState } from 'react';
import { BgColorsOutlined } from '@ant-design/icons';
import BadgeListByType from './BadgeListByType';
import type { BadgeTypeSlug } from './BadgeListByType';
import CreateBadgeModal from './CreateBadgeModal';

function CosmeticBadgesList() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <BadgeListByType
        badgeType={'COSMETIC' as BadgeTypeSlug}
        listPath="/gamification/cosmetic-badges"
        title="Cosmetic Badges"
        description="Cosmetic badges list and management"
        icon={<BgColorsOutlined />}
        onOpenCreate={() => setCreateOpen(true)}
      />
      {createOpen && (
        <CreateBadgeModal
          badgeType="COSMETIC"
          listPath="/gamification/cosmetic-badges"
          onClose={() => setCreateOpen(false)}
          onSuccess={() => setCreateOpen(false)}
        />
      )}
    </>
  );
}

export default CosmeticBadgesList;
