import React from 'react';

import {
  Card,
  Alert,
  Button,
  Typography,
  Space
} from 'antd';

import {
  ArrowLeftOutlined,
  ToolOutlined
} from '@ant-design/icons';

import {
  useLocation,
  useNavigate,
  useParams
} from 'react-router-dom';


const { Title, Paragraph } = Typography;


const BendReplacementSuggestionPage = () => {
  const { analysisId } = useParams();

  const location = useLocation();
  const navigate = useNavigate();

  const bendAnalysis =
    location.state?.bendAnalysis || null;

  const sourceFile =
    location.state?.source_file || null;


  return (
    <div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          gap: 16,
          flexWrap: 'wrap'
        }}
      >

        <div>
          <Title level={2} style={{ marginBottom: 4 }}>
            Bend Replacement Suggestions
          </Title>

          <Paragraph
            type="secondary"
            style={{ marginBottom: 0 }}
          >
            Replacement suggestions based on exact bend-part
            matches and pricing data.
          </Paragraph>
        </div>

        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
        >
          Back to Bend Analysis
        </Button>

      </div>


      <Card>

        <Alert
          message="Replacement Suggestion Module"
          description={
            `This module is prepared for the Bend / Snap replacement
            suggestion functionality. The actual replacement logic,
            price comparison, savings calculation and recommendation
            table will be added here next.`
          }
          type="info"
          showIcon
          icon={<ToolOutlined />}
        />

        <div style={{ marginTop: 24 }}>

          <Space direction="vertical" size="middle">

            <div>
              <strong>Analysis ID:</strong>{' '}
              {analysisId || 'N/A'}
            </div>

            <div>
              <strong>Source File:</strong>{' '}
              {sourceFile?.filename || 'N/A'}
            </div>

            <div>
              <strong>Exact Match Pairs:</strong>{' '}
              {bendAnalysis?.exact_match_pairs?.length || 0}
            </div>

          </Space>

        </div>

      </Card>

    </div>
  );
};


export default BendReplacementSuggestionPage;