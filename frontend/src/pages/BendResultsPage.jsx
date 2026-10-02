import React, { useEffect, useMemo, useState } from 'react';

import {
  Card,
  Table,
  Tag,
  Alert,
  Button,
  Spin,
  message,
  Statistic,
  Row,
  Col,
  Input,
  Select,
  Space,
  Divider
} from 'antd';

import {
  SearchOutlined,
  ReloadOutlined,
  FileExcelOutlined
} from '@ant-design/icons';

import UploadedFileViewer from '../components/UploadedFileViewer';

import { getAnalysisResults } from '../services/api';

import {
  useParams,
  useLocation,
  useNavigate
} from 'react-router-dom';


const BendResultsPage = () => {
  const [results, setResults] = useState(null);
  const [sourceFile, setSourceFile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState('');
  const [selectedBendCount, setSelectedBendCount] = useState('all');

  const { analysisId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();


  useEffect(() => {
    if (location.state?.analysisResults?.bend_pairwise) {
      setResults(location.state.analysisResults.bend_pairwise);

      setSourceFile(
        location.state.source_file ||
        location.state.analysisResults?.source_file ||
        null
      );

      setLoading(false);
    } else if (analysisId) {
      loadAnalysisResults();
    } else {
      setLoading(false);
    }
  }, [analysisId, location.state]);


  const loadAnalysisResults = async () => {
    try {
      setLoading(true);

      const response = await getAnalysisResults(analysisId);
      const data = response.data;

      const raw = data.raw || data;

      const bendRes =
        raw?.bend_pairwise ||
        raw?.bend_pairwise_result ||
        data.bend_pairwise_result;

      setResults(bendRes || null);

      setSourceFile(
        data.source_file ||
        raw?.source_file ||
        null
      );

    } catch (err) {
      console.error('Error loading bend results:', err);
      message.error('Failed to load bend analysis results');
    } finally {
      setLoading(false);
    }
  };


  const handleViewReplacementSuggestions = () => {
    navigate(`/results/bends/replacements/${analysisId}`, {
      state: {
        bendAnalysis: results,
        source_file: sourceFile
      }
    });
  };


  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
        <p>Loading bend pairwise analysis results...</p>
      </div>
    );
  }


  if (!results) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Alert
          message="No Bend Analysis Results Found"
          description="Please run a Bend / Snap Analysis to view results."
          type="info"
          showIcon
          action={
            <Button
              type="primary"
              onClick={() => navigate('/analysis')}
            >
              Run Bend Analysis
            </Button>
          }
        />
      </div>
    );
  }


  /*
   * Backend structure:
   *
   * {
   *   total_rows,
   *   total_parts,
   *   valid_parts,
   *   invalid_parts,
   *   ignored_rows,
   *   coordinate_groups,
   *   exact_match_groups,
   *   exact_match_pairs,
   *   invalid_rows,
   *   ignored_rows_detail
   * }
   */

  const totalRows = results.total_rows || 0;
  const totalParts = results.total_parts || 0;
  const validParts = results.valid_parts || 0;
  const invalidParts = results.invalid_parts || 0;
  const ignoredRows = results.ignored_rows || 0;

  const coordinateGroups = results.coordinate_groups || [];

  const exactMatchGroups = results.exact_match_groups || [];
  const exactMatchPairs = results.exact_match_pairs || [];

  const invalidRows = results.invalid_rows || [];


  /*
   * Build table data.
   *
   * The backend currently returns:
   *
   * {
   *   part_a,
   *   part_b,
   *   bend_count,
   *   match_percentage,
   *   match_type
   * }
   *
   * We transform it into Ant Design table-friendly data.
   */

  const tableData = exactMatchPairs.map((item, index) => ({
    key: `${item.part_a}-${item.part_b}-${item.bend_count}-${index}`,
    'Part A': item.part_a,
    'Part B': item.part_b,
    'No. of Bends': item.bend_count,
    'Match %': item.match_percentage,
    'Match Type': item.match_type || 'exact'
  }));


  /*
   * Dynamically generate unique bend-count values.
   *
   * Example:
   * All
   * 2
   * 3
   * 4
   */

  const uniqueBendCounts = [
  ...new Set(
    tableData
      .map(item => Number(item['No. of Bends']))
      .filter(value => Number.isFinite(value))
  )
];

uniqueBendCounts.sort((a, b) => a - b);

const bendCountOptions = [
  {
    value: 'all',
    label: 'All Bend Counts'
  },
  ...uniqueBendCounts.map(count => ({
    value: String(count),
    label: `${count} Bends`
  }))
];


  /*
   * Filter table using:
   *
   * 1. Bend count
   * 2. Part A / Part B search
   */

  const query = searchText.trim().toLowerCase();

const filteredData = tableData.filter(item => {
  const bendMatches =
    selectedBendCount === 'all' ||
    String(item['No. of Bends']) === String(selectedBendCount);

  if (!bendMatches) {
    return false;
  }

  if (!query) {
    return true;
  }

  return (
    String(item['Part A'] || '')
      .toLowerCase()
      .includes(query) ||
    String(item['Part B'] || '')
      .toLowerCase()
      .includes(query)
  );
});

  /*
   * Count displayed pairs for the selected bend filter.
   */

  const selectedPairCount = filteredData.length;


  /*
   * Replacement data may not exist yet.
   *
   * We intentionally keep the button disabled until the
   * replacement-analysis backend is implemented.
   */

  const replacementRows =
    results?.replacement_suggestions?.replacement_rows || [];

  const replacementAvailable =
    replacementRows.length > 0;


  const columns = [
    {
      title: 'Part A',
      dataIndex: 'Part A',
      key: 'Part A',
      sorter: (a, b) =>
        String(a['Part A']).localeCompare(
          String(b['Part A'])
        ),
      render: text => (
        <strong style={{ fontFamily: 'monospace' }}>
          {text}
        </strong>
      )
    },

    {
      title: 'Part B',
      dataIndex: 'Part B',
      key: 'Part B',
      sorter: (a, b) =>
        String(a['Part B']).localeCompare(
          String(b['Part B'])
        ),
      render: text => (
        <strong style={{ fontFamily: 'monospace' }}>
          {text}
        </strong>
      )
    },

    {
      title: 'No. of Bends',
      dataIndex: 'No. of Bends',
      key: 'No. of Bends',
      sorter: (a, b) =>
        Number(a['No. of Bends']) -
        Number(b['No. of Bends']),
      render: value => (
        <Tag color="blue">
          {value}
        </Tag>
      )
    },

    {
      title: 'Match %',
      dataIndex: 'Match %',
      key: 'Match %',
      sorter: (a, b) =>
        Number(a['Match %'] || 0) -
        Number(b['Match %'] || 0),
      defaultSortOrder: 'descend',
      render: value => (
        <Tag color="green">
          {Number(value).toFixed(1)}%
        </Tag>
      )
    },

    {
      title: 'Match Type',
      dataIndex: 'Match Type',
      key: 'Match Type',
      sorter: (a, b) =>
        String(a['Match Type']).localeCompare(
          String(b['Match Type'])
        ),
      render: value => (
        <Tag color="green">
          {value === 'exact' ? 'Exact Match' : value}
        </Tag>
      )
    }
  ];


  return (
    <div>

      {/* Header */}

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
          <h1 style={{ marginBottom: 4 }}>
            Bend / Snap Pairwise Analysis
          </h1>

          <div style={{ color: '#666' }}>
            Exact matching based on bend count, development length
            and coordinate data.
          </div>
        </div>

        <Space>

          <Button
            icon={<ReloadOutlined />}
            onClick={loadAnalysisResults}
            loading={loading}
          >
            Refresh
          </Button>

          <Button
            icon={<FileExcelOutlined />}
            onClick={() => {
              message.info(
                'Bend Excel export will be implemented next.'
              );
            }}
          >
            Export Excel
          </Button>

        </Space>
      </div>


      {/* Source File */}

      {sourceFile && (
        <Card style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >

            <div>
              <div style={{ fontWeight: 600 }}>
                Source File
              </div>

              <div style={{ color: '#666' }}>
                {sourceFile.filename}
              </div>
            </div>

            <UploadedFileViewer
              sourceFile={sourceFile}
              buttonText="View Uploaded File"
            />

          </div>
        </Card>
      )}


      {/* Statistics */}

      <Row
        gutter={16}
        style={{ marginBottom: 20 }}
      >

        <Col span={6}>
          <Card>
            <Statistic
              title="Total Parts"
              value={totalParts}
              valueStyle={{
                color: '#1890ff',
                fontSize: '24px'
              }}
            />
          </Card>
        </Col>


        <Col span={6}>
          <Card>
            <Statistic
              title="Valid Parts"
              value={validParts}
              valueStyle={{
                color: '#52c41a',
                fontSize: '24px'
              }}
            />
          </Card>
        </Col>


        <Col span={6}>
          <Card>
            <Statistic
              title="Invalid Parts"
              value={invalidParts}
              valueStyle={{
                color: invalidParts > 0
                  ? '#ff4d4f'
                  : '#52c41a',
                fontSize: '24px'
              }}
            />
          </Card>
        </Col>


        <Col span={6}>
          <Card>
            <Statistic
              title="Exact Match Pairs"
              value={exactMatchPairs.length}
              valueStyle={{
                color: '#722ed1',
                fontSize: '24px'
              }}
            />
          </Card>
        </Col>

      </Row>


      {/* Replacement Suggestions */}

      <Card
        style={{
          marginBottom: 20,
          background: replacementAvailable
            ? '#f6ffed'
            : '#fffbe6',
          borderColor: replacementAvailable
            ? '#b7eb8f'
            : '#ffe58f'
        }}
      >

        {replacementAvailable ? (

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >

            <div>
              <h3 style={{ marginBottom: 8 }}>
                Cost-Effective Replacement Suggestions
              </h3>

              <p style={{ marginBottom: 0 }}>
                Exact-match bend parts with lower-cost
                alternatives are available.
              </p>
            </div>

            <Button
              type="primary"
              onClick={handleViewReplacementSuggestions}
            >
              View Replacement Suggestions
            </Button>

          </div>

        ) : (

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >

            <div>
              <h3 style={{ marginBottom: 8 }}>
                Replacement Suggestions
              </h3>

              <p style={{ marginBottom: 0 }}>
                Replacement suggestion functionality will be
                available after price and replacement analysis
                is implemented.
              </p>
            </div>

            <Button
              type="primary"
              onClick={handleViewReplacementSuggestions}
            >
              View Replacement Suggestions
            </Button>

          </div>

        )}

      </Card>

      {/* Main Results Table */}

      <Card
        title={
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap'
            }}
          >

            <span>
              Exact Match Results ({filteredData.length} pairs displayed)
            </span>

            <Space wrap>

              <Select
                value={selectedBendCount}
                options={bendCountOptions}
                onChange={value =>
                  setSelectedBendCount(value)
                }
                style={{ width: 180 }}
              />

              <Input
                placeholder="Search Part A or Part B..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={e =>
                  setSearchText(e.target.value)
                }
                style={{ width: 250 }}
                allowClear
              />

            </Space>

          </div>
        }
      >

        <Table
          columns={columns}
          dataSource={filteredData}
          pagination={{
            defaultPageSize: 20,
            pageSizeOptions: [
              '10',
              '20',
              '50',
              '100',
              '500'
            ],
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} pairs`
          }}
          rowKey="key"
          size="middle"
          locale={{
            emptyText:
              selectedBendCount === 'all'
                ? 'No exact matching bend pairs found.'
                : `No exact matching pairs found for ${selectedBendCount} bends.`
          }}
        />

      </Card>

    </div>
  );
};


export default BendResultsPage;