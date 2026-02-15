import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'index.html');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error serving index.html:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
