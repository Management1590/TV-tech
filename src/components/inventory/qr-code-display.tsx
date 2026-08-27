'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface QrCodeDisplayProps {
  value: string;
  title?: string;
  size?: number;
}

export function QrCodeDisplay({ value, title = 'QR Code', size = 128 }: QrCodeDisplayProps) {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        <div className="bg-white p-3 rounded-lg">
          <QRCodeSVG value={value} size={size} />
        </div>
      </CardContent>
    </Card>
  );
}
