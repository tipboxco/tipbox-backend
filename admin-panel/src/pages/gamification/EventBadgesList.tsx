import { useState } from 'react';
import { TrophyOutlined } from '@ant-design/icons';
import BadgeListByType from './BadgeListByType';
import type { BadgeTypeSlug } from './BadgeListByType';
import CreateBadgeModal from './CreateBadgeModal';

function EventBadgesList() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <BadgeListByType
        badgeType={'EVENT' as BadgeTypeSlug}
        listPath="/gamification/event-badges"
        title="Event Badges"
        description="Event / community badges list and management"
        icon={<TrophyOutlined />}
        onOpenCreate={() => setCreateOpen(true)}
      />
      {createOpen && (
        <CreateBadgeModal
          badgeType="EVENT"
          listPath="/gamification/event-badges"
          onClose={() => setCreateOpen(false)}
          onSuccess={() => setCreateOpen(false)}
        />
      )}
    </>
  );
}

export default EventBadgesList;
