import { useState } from 'react';
import { TagOutlined } from '@ant-design/icons';
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
        description="Brand badges list and management"
        icon={<TagOutlined />}
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
